---
layout: post
title: "Making local LLM fast"
description: "How Fono gets the first word out of a local language model in a third of a second and why it used to be slow"
category: "Programming"
tags: [Rust, LLM, llama.cpp, Performance, Fono]
---

I built a tool called [Fono](https://github.com/bogdanr/fono). It's a voice front-end for your computer that can run entirely on your own machine. No cloud, no account, no audio leaving the laptop. It has three jobs, on two hotkeys:

- **Hold F7 to dictate** and cleaned-up text lands in whatever window you were typing in.
- **Hold F8 to talk to an assistant** and it answers various thinkgs. It can also call tools (look at what's on your screen, and more to come) to actually do things, not just reply.
- **Give your computer a voice.** Coding agents or other tools can speak to you through it.

The first two jobs can lean on a local language model. The problem is that a local model has to think before it speaks, and that feels slow in a way a cloud API running on a rack of GPUs does not. On my laptop, the very first assistant turn was taking almost three seconds before a single word came back. By the sixth turn of a conversation it was closer to seven. That's death by a thousand milliseconds. It makes the whole thing feel broken even when it's working perfectly.

This post is the story of getting that first word out in about a third of a second instead. I will explain what actually costs the time, show you the bug I made (it's a good one) and give you the exact commands to reproduce everything on your own hardware. I don't do "trust me bro" benchmarks :)

### What actually takes the time

When you send a prompt to a local model, the work splits into two very different phases.

**Prefill** is the model reading your prompt. Every token (every chunk of text) gets pushed through the neural network so the model "understands" the context before it responds.

**Decode** is the model answering. You watch this happen, word by word.

The number a user feels is the **time to first token**. That's the gap between letting go of the hotkey and the first word appearing. (In Fono it's a bit more complex, but we'll go with this.) That gap is almost entirely prefill. Decode controls how fast the answer then streams out, but prefill is what makes you sit there wondering if anything is happening.

If you are not careful, a local chat assistant makes you pay prefill over and over. Every turn, the model re-reads the entire conversation so far: the system instructions, every previous question, every previous answer. All that work just to append one new sentence. Turn six pays for turns one through five all over again.

<div id="fll-prefill-restore" class="fll-widget"></div>

### Detour: how prefill and decode stress hardware

Let's spend 2 minutes on this because I find it very interesting. Prefill and decode bottleneck on different parts of your computer.

**Prefill is compute-bound.** All the prompt's tokens can go through the network together, in one big parallel batch of matrix multiplications. That keeps every core and every SIMD lane (the AVX/NEON instructions that do many multiply-adds per clock) busy. More cores and wider vector instructions make prefill faster. This is why the right build of llama.cpp for your CPU matters a little bit.

**Decode is memory-bandwidth-bound.** To produce one token, the model has to read essentially all of its weights out of RAM. A 4-billion-parameter model at 4 bits is roughly 2-3 GB. Generating 100 tokens means streaming those gigabytes from memory a hundred times over. Your cores spend most of that time waiting for data, not computing. This is the dirty secret of local LLM speed. Decode is usually limited by how fast you can move the model out of RAM, not by raw math. It's also why quantization (shrinking the weights) speeds decoding up and why fast memory matters.

Of course, there are many caveats here, but let's keep this lean :)

<div id="fll-bandwidth" class="fll-widget"></div>

Two takeaways set up the rest of the post. First, since the latency you feel is dominated by prefill, and prefill cost is "how much prompt do I have to read", the way to win is to **read less prompt**. Second, the part of the prompt we re-read every turn is exactly the part that doesn't change. We shouldn't be reading it at all.

### The trick: stop reading what you already read

The model's "understanding" of the prompt isn't thrown away after prefill. It lives in a chunk of memory called the **KV cache** (key/value cache, the name doesn't matter here). Think of it as the model's working memory of everything it has read so far.

The insight that makes local models usable: **if the start of this turn's prompt is identical to last turn's, the model's working memory for that part is identical too. So don't recompute it, reuse it.** Snapshot that state and next turn restore the snapshot instead of prefilling from scratch. Restoring is basically a memory copy. In Fono it takes **15-40 milliseconds** regardless of size. Prefilling the same content cold can take **seconds** (the right lane in the animation above). That's the whole game.

There is one ironclad rule though, and it's where I shot myself in the foot.

### Reuse only works from the front

Cache reuse only works for a prefix that is **byte-for-byte identical from the very first token**. The moment something changes early in the prompt, every token after it must be recomputed. It's like a spreadsheet. Change cell A1 and every formula below recalculates.

So the order you put things in completely decides how much you get to reuse. The stuff that never changes (system prompt, tool descriptions) wants to be at the **front**, forming a stable prefix you cache once and reuse forever. The stuff that changes every turn (the new thing the user just said) goes at the **back**.

I had it exactly backwards.

### The dumb bug

There were several dumb bugs. The model got loaded twice at some point. And other where a bit more complex. I'll share an easy one so we can laugh together.

Fono now ships with Google's Gemma as the default local model. Gemma's prompt format has no dedicated slot for system instructions like some models have, so when I first implemented it I glued the system prompt onto the current user turn:

```
[ conversation history ]
<start_of_turn>user
{the entire big system prompt + tools}
User request: {what you just said}
```

Read that with the prefix rule in mind. On turn one it's fine because there is no history and the system prompt sits at the front. But on turn two, the conversation history slides in front of the system prompt. The big unchanging block is no longer at position zero. The prefix is broken. The cache misses. The model re-reads everything, every single turn.

I built the entire snapshot-and-restore machine and then laid out the prompt so it could basically never fire after the first turn.

<div id="fll-prompt-layout" class="fll-widget"></div>

### The fix

Put the system prompt where it belongs: **first**.

Now the prompt is **append-only**. Each turn only adds to the end, and everything before the new line is a byte-for-byte stable prefix. The system prompt is cached once, at startup, and reused on every turn of every conversation. Each turn, the only thing the model actually reads is the new sentence you just spoke. A couple of dozen tokens on top of a restored snapshot.

I wrapped this in regression tests that walk a three-turn conversation and assert each turn's prompt is an exact string prefix of the next turn's. If anyone reorders the prompt and breaks the append-only property again, the tests fail loudly. I don't trust myself to not make this mistake twice.

Then I was caching garbage because the template was off but still, caching worked :)

### The two paths, and how they reuse the cache

The append-only layout gives both hotkeys a stable **base** at the front of the prompt. Fono prefills it once at startup, snapshots it and **pins** it so it's never evicted. For F7 (dictation) the base is your cleanup instructions plus a personal dictionary. For F8 (the assistant) it's the system prompt plus the tool descriptions. Everything else stacks on top.

Play with the buttons below to get an intuitive feel how it works.

<div id="fll-pipeline" class="fll-widget"></div>

**F7 fans out.** Dictation cares which app you're in because text for a terminal reads differently than text for a chat box. So each app gets its own snapshot and they all branch off the same pinned base. The first time you dictate into your editor, Fono restores the base, decodes the small editor context on top and saves that branch. Every dictation into the editor after that restores the editor snapshot whole and decodes nothing but your words. What you actually said is never cached. Only the reusable prefix is kept.

**F8 builds a chain.** The assistant is a conversation, so each turn is stacked on the previous one. Turn one restores the pinned base, decodes your first request and the reply, and saves the result as the turn-one snapshot. Turn two restores turn one and decodes only the new exchange. Nothing earlier in the conversation is ever re-read. The cost of a turn tracks what you just said, not how long you've been talking. Conversations expire after five idle minutes, which trims the chain back to the pinned base.

Both shapes use the same two ideas. A pinned base that pays the expensive work only once, and longest-prefix restore: start from the deepest snapshot that still matches and decode only the delta.

### The numbers

Same laptop, same model (Gemma 4 E2B, 4-bit quantized), same six-turn conversation. First the headline. Time to first word, turn by turn, with the cache working versus not. The "not" line is exactly what my system-in-the-tail bug produced. The gray line is ollama, which we get to in a bit.

<div id="fll-race" class="fll-widget"></div>

And the same data as a table, with the checkpoint size and the restore time that replaces the growing prefill:

| Turn | History | Tokens | Uncached first token | Cached first token | Restore | Checkpoint |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 31 | 786 ms | 341 ms | 30 ms | 0.6 MB |
| 2 | 2 | 90 | 1,917 ms | 641 ms | 39 ms | 1.7 MB |
| 3 | 4 | 150 | 2,468 ms | 383 ms | 37 ms | 2.8 MB |
| 4 | 6 | 211 | 3,321 ms | 509 ms | 34 ms | 3.9 MB |
| 5 | 8 | 273 | 4,367 ms | 491 ms | 15 ms | 5.0 MB |
| 6 | 10 | 333 | 4,892 ms | 375 ms | 21 ms | 6.1 MB |

The uncached column climbs as the conversation grows. The cached column stays flat because each turn restores a snapshot (15-40 ms) and only reads your new sentence.

To make the effect impossible to miss, I also swept the size of the cached prefix directly. Imagine an assistant with a big pile of tool definitions in its system prompt. Here is the first-token latency as that prefix grows from tiny to about 3,300 tokens, cold prefill versus cached restore:

| Prefix (tool defs) | Prefix tokens | Cold prefill | Cached first token | Checkpoint |
|---:|---:|---:|---:|---:|
| none | 25 | 217 ms | 114 ms | 0.5 MB |
| 5 tools | 424 | 5,143 ms | 115 ms | 7.8 MB |
| 10 tools | 821 | 10,341 ms | 118 ms | 15.2 MB |
| 20 tools | 1,631 | 21,077 ms | 120 ms | 30.1 MB |
| 40 tools | 3,251 | 44,806 ms | 133 ms | 60.0 MB |

Read the last row twice. A cold prefill of a 3,251-token system prompt takes **45 seconds** on this modern CPU. The cached restore serves the first token in **133 ms** and the cost is a 60 MB snapshot sitting in RAM. A little memory for a lot of saved latency.

This is what makes local tool use feasible in the future. It's already on the [roadmap](https://github.com/bogdanr/fono/blob/main/ROADMAP.md) :)

### Keeping it bounded

Trading memory for latency is only a good trade if the memory can't run away. The scale is smaller than it looks. The KV cache runs about **18 KB per token**, so one user-and-assistant exchange adds about a megabyte. The big snapshots come from prefixes, not history. A fat tool-definition block is 60 MB on its own.

Three things keep the cache in check:

1. **Pruning.** While a conversation grows, each new checkpoint contains the previous one, so the old one is deleted on the spot. A short conversation sits at one live checkpoint, not one per turn.
2. **A rolling window.** Assistant memory is capped at 12 turns within a 5-minute window of activity. Once the window starts sliding, the oldest turn drops off the front, old checkpoints can't be pruned anymore and they fall under the hard bound below. Go idle for more than 5 minutes and the history is wiped, so the next turn restores just the base. That's the cheapest case there is.
3. **A hard bound.** Everything else (other apps' dictation contexts, one-off window grabs, leftovers from long conversations) is capped at **8 checkpoints and 256 MB total**. When a limit is crossed, the least-recently-used entry is evicted. The pinned bases are never evicted.

<div id="fll-lru" class="fll-widget"></div>

One subtlety makes all this deleting safe. Each snapshot is a complete, standalone copy of the model state, not a link to the previous one. The chain is only how a snapshot gets built cheaply. Once saved, it refers to nothing else, so removing one snapshot can never corrupt another. The cost is some redundancy (the base prefix is duplicated inside every snapshot built on top of it) and that is exactly why the byte budget and the pruning exist.

### But is it actually faster than ollama?

Here is where I have to be honest, because it's easy to lie with a chart.

ollama is the popular way to run local models. It's built on the same engine (llama.cpp) that Fono uses. I imported the exact same model file into ollama and ran the exact same conversation over its local API, feeding its own replies back so its cache worked at its best.

ollama is not naive. It has a server-side prefix cache too and it works. Its prefill stays roughly flat across the conversation instead of climbing. So this isn't "clever Fono vs. clueless ollama". It's a tool tuned for one job vs. a general-purpose server:

| Turn | Fono cached first token | ollama first token | ollama prefill |
|---:|---:|---:|---:|
| 1 (cold) | 341 ms | 2,649 ms | 790 ms |
| 2 | 641 ms | 1,397 ms | 1,059 ms |
| 3 | 383 ms | 1,322 ms | 973 ms |
| 4 | 509 ms | 1,352 ms | 955 ms |
| 5 | 491 ms | 1,317 ms | 922 ms |
| 6 | 375 ms | 1,521 ms | 1,216 ms |

Warm, Fono is roughly **2-4x faster** to the first word. On the cold first turn it's about **8x**. Both run the same weights at the same quantization, so the gap is all integration:

- **Fono runs the model in-process.** No HTTP hop to a separate server and no second copy of anything. Restoring a snapshot is a local memory operation.
- **Fono warms the cache at startup.** The system-prompt snapshot is built once when the app launches, while you're not waiting on anything. Turn one is already as fast as turn six. ollama builds it on the first request, so its first turn is cold.
- **Fono lays the prompt out for maximum reuse.** The whole point of this post.

A fair warning. These are CPU-bound numbers on a laptop, medians of a few passes, and a little noisy. One ollama turn spiked to 5.6s and I took the median to ignore it. This is not a benchmark-suite-grade result. It shows that a tool built for one job can shave the latency that a general server leaves on the table.

### Replicate it yourself

I don't like "trust me bro" benchmarks. Everything above comes out of Fono's own benchmark binary and a small script against ollama. Here is how to run it.

**The machine:** an 8-thread CPU, no GPU, 4 GB context. Same `gemma-4-e2b` GGUF (4-bit) for both engines.

**Fono's side.** Build the bench tool with the embedded llama.cpp backend and run the multi-turn conversation benchmark:

```sh
cargo build --release -p fono-bench --features llama-local

./target/release/fono-bench assistant-conversation-cache \
  --model-path /path/to/gemma-4-e2b.gguf \
  --turn "turn on the kitchen light" \
  --turn "now dim it to fifty percent" \
  --turn "what's the weather tomorrow morning" \
  --turn "add milk and eggs to my shopping list" \
  --turn "set a timer for ten minutes" \
  --turn "what did I ask you to buy" \
  --ctx-size 4096 --threads 8 --batch-size 4096 \
  --iterations 2 --out conversation-cache.json
```

It replays the conversation through Fono's actual prompt builder and for each turn reports the cold prefill, the cached restore and both first-token timings. The prefix-size sweeps are a sibling command:

```sh
./target/release/fono-bench assistant-cache-scaling \
  --model-path /path/to/gemma-4-e2b.gguf \
  --dimension tools --sizes 0,5,10,20,40 \
  --ctx-size 4096 --threads 8 --batch-size 4096 --out cache-scaling-tools.json
```

(One gotcha I hit: set `--batch-size` at least as large as your biggest prompt, or llama.cpp aborts when a single prefill overflows the logical batch.)

**ollama's side.** Import the same GGUF and drive a growing conversation over the local API, feeding the model its own replies back so its prefix cache is maximally effective:

```sh
printf 'FROM /path/to/gemma-4-e2b.gguf\n' > Modelfile
ollama create fono-gemma-bench -f Modelfile
```

Then loop over the turns hitting `POST /api/generate` with `"raw": true` and the same system-first, append-only prompt layout Fono emits. Record the wall-clock time to the first streamed token and the server's reported `prompt_eval_duration`. The Python script of about 40 lines lives alongside the JSON artifacts. It just builds the append-only prompt, streams the response and records timings.

Point being, same model, same machine, same conversation, both numbers measured the same way. Run it and tell me if your laptop disagrees with mine.

I also did GPU runs and other older CPUs but let's keep it focused. Maybe at some point I write about how I did [900+ benchmark runs](https://fono.page/calibration/) to tune Fono's first run wizard.

### Takeaways

1. **For a local LLM, the latency you feel is prefill, and prefill is the prompt you re-read every turn.** Optimize that and everything feels instant.
2. **Cache reuse only works from the front.** Put the unchanging stuff (system prompt, tools) first and the new stuff last. Keep the prompt append-only.
3. **Order is an architectural decision.** My slowest and fastest paths generated identical text in a different order. One reused everything, one reused nothing.
4. **Know which phase is compute-bound and which is bandwidth-bound.** It tells you whether more cores, a better-compiled binary or faster RAM will actually help.
5. **Warm the cache before the user needs it, and remember it costs RAM.** Startup is free time, spend it. Bound the cache so it can't eat the machine.
6. **Test the invariant, not just the output.** "Each turn's prompt is a prefix of the next" is a one-line property that would have caught my bug on day one.

The cache work is committed. Next on the list is making sure the heavy prompt-building never fights the speech-to-text engine for CPU while you're mid-sentence. That's a scheduling problem for another post.

If you want to read the actual code, it's all in the [Fono repository](https://github.com/bogdanr/fono). GPL-3.0.

<link rel="stylesheet" href="/assets/css/fono-llm-speed.css">
<script src="/assets/js/fono-llm-speed.js"></script>
