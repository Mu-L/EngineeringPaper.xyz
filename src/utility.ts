import { unit, bignumber, type Unit } from "mathjs";

export function convertUnits(value: string, startingUnits: string, userUnits: string) {
  if (startingUnits === "") {
    startingUnits = "in/in"; // only way to specify unitless for mathjs
  }
  if (userUnits === "") {
    userUnits = "in/in";
  }

  let startingValuePlusUnits: Unit;
  try {
    startingValuePlusUnits = unit(bignumber(value), startingUnits);
    unit(userUnits); // just checking that it parses for later
  } catch(e) {
    console.warn(`Units not recognized, either ${startingUnits} or ${userUnits}`);
    return { value: null, unitsMismatch: true};
  } 

  // check that dimensions are compatible for the conversion
  let newValue: number;
  try {
    newValue = startingValuePlusUnits.toNumber(userUnits)
  } catch(e) {
    return { value: null, unitsMismatch: true};
  }

  return {newValue: newValue, unitsMismatch: false }
}


export function arraysEqual(a: any[], b: any[]) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}


export function unitsEquivalent(units1: string, units2: string) {
  try {
    if (arraysEqual(unit(units1).dimensions, unit(units2).dimensions)) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    // One of the units not recognized by mathjs
    // Units cannot be used so mark them as not matching
    console.warn(`Units not recognized, either '${units1}' or '${units2}' caused the error`);
    return false;
  }
}


export function convertArrayUnits(values: number[], startingUnits: string, userUnits: string) {
  if (startingUnits === "") {
    startingUnits = 'in/in';
  }
  return values.map(value => {
    return unit(value, startingUnits).toNumber(userUnits);
  });
}


export function unitsValid(units: string): boolean {
  return (units !== "Exponent Not Dimensionless" && units !== "Dimension Error");
}


export function isVisible(element: HTMLElement, container: HTMLElement) {

  const { bottom, top } = element.getBoundingClientRect();
  const { bottom: containerBottom, top: containerTop } = container.getBoundingClientRect();
  return top >= containerTop && bottom <= containerBottom;
}


// Version must be integer of form YYYYMMDD
// Assumes version date is in CST
export function versionToDateString(version: number) {
  const versionString = version.toString();
  return (new Date(`${versionString.slice(0,4)}-${versionString.slice(4,6)}-${versionString.slice(6)}T00:00:00.000-06:00`)).toLocaleDateString();
}

