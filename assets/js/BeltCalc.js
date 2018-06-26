// LP = Large Pulley Diameter (User Input)
// SP = Small Pulley Diameter (User Input)
//
// CD = Center Distance (User Input)
// L = Calculated Belt Length
//
// BL = Belt Length (User Input)
// CD = Calculated Center Distance

//--------------------------------------------------------------------------------------------
// Belt Length Calculator
function calcLen() {
	var LP=eval(document.frmCalc.LP1.value)
	var SP=eval(document.frmCalc.SP1.value)
	var CD=eval(document.frmCalc.CD1.value)
	var L
	if (LP<SP) {
		alert("The large pulley diameter must be greater than the small pulley diameter")
	}
	else if (LP <= 0 || SP <= 0) {
	 	alert("Pulley Diameters must be greater than 0")
	}
	else if (CD < (SP+LP) / 2) {
		alert("Invalid geometry: Center Distance is too short")
	}
	else {
		L=2 * CD + Math.pow((LP - SP),2)/(4 * CD) + 1.57 * (LP + SP)
		document.frmCalc.length.value=imkRound(L,3)
	}
}

//--------------------------------------------------------------------------------------------
// Center Distance Calculator
function calcCD() {
	var LP=eval(document.frmCalc.LP2.value)
	var SP=eval(document.frmCalc.SP2.value)
	var BL=eval(document.frmCalc.BL2.value)
	var CD
	var K
	var a
	var b
	var c
	if (LP<SP) {
		alert("The large pulley diameter must be greater than the small pulley diameter")
	}
	else if (LP <= 0 || SP <= 0) {
	 	alert("Pulley Diameters must be greater than 0")
	}   
	else if (BL < (SP / 2) + (LP / 2)) {
		alert("Invalid geometry: Belt Length is too short")
	}
	else {
		K=4 * BL - 6.28 * (LP + SP)
		a=Math.pow(K,2)
		b=Math.pow((LP - SP),2)
		c=Math.pow((a - 32 * b),.5)
		CD=(K + c) / 16
		document.frmCalc.cendis.value=imkRound(CD,3)
	}
}

//--------------------------------------------------------------------------------------------
function imkRound(val, places)
{
  if(isNaN(places) != true)
  {
    places = Math.abs(places);
    var den = Math.pow(10, places);
    var x = Math.round(val * den);
    return x/den;
  }
  else
  {
    return NaN;
  }
}
