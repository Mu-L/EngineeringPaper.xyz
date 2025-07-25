<script lang="ts">
  import { onMount } from 'svelte';
  import { unit } from 'mathjs';
  import appState from './stores.svelte';
  import type { CodeFunctionQueryStatement } from './parser/types';
  import { getConversionFactor } from './utility';
  import MathCell from './cells/MathCell.svelte';
  import { type FiniteImagResult, type Result, type MatrixResult, isMatrixResult,
           isDataTableResult } from './resultTypes';
  import { InlineLoading, CodeSnippet } from 'carbon-components-svelte';
  import Information from "carbon-icons-svelte/lib/Information.svelte";
  
  interface Props {
    pyodidePromise: Promise<any>;
    index: number;
    mathCellChanged: () => void;
    triggerSaveNeeded: () => void;
  }

  let {
    pyodidePromise,
    index,
    mathCellChanged,
    triggerSaveNeeded
  }: Props = $props();

  let cell = $derived(appState.cells[index]);
  
  let result = $derived.by(() => {
    {
      const tempResult = appState.results[index];    
      if (tempResult && !(tempResult instanceof Array) && !isDataTableResult(tempResult)) {
      return tempResult;
    } else {
      return null;
    }
  }
  });

  let statement = $derived.by(() => {
    if (cell instanceof MathCell && cell.mathField.statement &&
        cell.mathField.statement.type === "query" && 
        cell.mathField.statement.isCodeFunctionQuery) {
      return cell.mathField.statement;
    } else {
      return null;
    }
  }) ;
  
  let generatedCode = $derived.by(() => {
    if (statement && result && "generatedCode" in result && result.generatedCode) {
      try {
        return codeTemplate(statement, result);
      } catch(e) {
        return `# Error generated code: ${e} If this error persists, report to support@engineeringpaper.xyz with the sheet that generates the error.`
      }
    } else {
      return "";
    }
  });

  onMount(() => {
    if (statement) {
      statement.generateCode = true;

      triggerSaveNeeded();
      mathCellChanged();
    }
  });
  
  function getUnitsDescription(unitsString: string): string {
    if (unitsString === "") {
      return "is unitless.";
    } else {
      return `has units of [${unit(unitsString).formatUnits()}].`;
    }
  }

  function getMatrixUnitsResult(result: MatrixResult, userUnit: string) {
    const resultUnitRows = [];
    
    if (userUnit) {
      const formattedUserUnit = unit(userUnit).formatUnits();
      for (const [i, row] of result.results.entries()) {
        const resultUnitRow = [];
        resultUnitRows.push(resultUnitRow);
        for (const[j, _] of row.entries()) {
          resultUnitRow.push(formattedUserUnit);
        }
      }
    } else {
      for (const [i, row] of result.results.entries()) {
        const resultUnitRow = [];
        resultUnitRows.push(resultUnitRow);
        for (const[j, value] of row.entries()) {
          if (value.units) {
            resultUnitRow.push(unit(value.units).formatUnits());
          } else {
            resultUnitRow.push("unitless");
          }
        }
      }
    }

    return `is a matrix with units [[${resultUnitRows.map(row => row.join(", ")).join('], [')}]]`;
  }

  function parameterMap(name: string, index: number) {
    return `    ${name} : float\n        '${name}' ${getUnitsDescription(statement.parameterUnits[index])}`;
  }

  function parameterConversionMap(name: string, index: number) {
    const currentUnit = statement.parameterUnits[index];

    if (currentUnit === "") {
      return "";
    }
    
    const { scaleFactor, offset } = getConversionFactor(currentUnit);

    if (offset === 0) {
      if (scaleFactor === 1) {
        return "";
      } else {
        return `    ${name} = ${name} * ${scaleFactor}`;
      }
    } else {
      if (scaleFactor === 1) {
        return `    ${name} = ${name} + ${offset}`;
      } else {
        return `    ${name} = (${name} + ${offset}) * ${scaleFactor}`;
      }
    }
  }

  function getReturnConversion(outputUnit: string) {
    if (outputUnit === "") {
      return "return result";
    }
    
    const { scaleFactor, offset } = getConversionFactor(outputUnit);

    if (offset === 0) {
      if (scaleFactor === 1) {
        return `return result`;
      } else {
        return `return result / ${scaleFactor}`;
      }
    } else {
      if (scaleFactor === 1) {
        return `return result - ${offset}`;
      } else {
        return `return (result / ${scaleFactor}) - ${offset}`;
      }
    }
  }

  function codeTemplate(statement: CodeFunctionQueryStatement, result: Result | FiniteImagResult | MatrixResult) {
    if (result.generatedCode.startsWith('# Error')) {
      return result.generatedCode;
    } else {
      let userReturnUnits = "";

      if (isMatrixResult(result)) {
        let matrixUnits = new Set<string>();
        for (const row of result.results) {
          for (const value of row) {
            matrixUnits.add(value.units);
          }
        }
        if (matrixUnits.size === 1) {
          if (statement.units) {
            userReturnUnits = statement.units;
          } else if (result.results[0][0].customUnitsDefined) {
            userReturnUnits = result.results[0][0].customUnits;
          }
        }
      } else if (statement.units) {
        userReturnUnits = statement.units;
      } else if (result.customUnitsDefined) {
        userReturnUnits = result.customUnits;
      }

      const finalCode = `${result.generatedCode.includes('numpy') ? "import numpy\n\n": ""}def ${statement.functionName}(${statement.parameterNames.join(", ")}):
    """
    Function '${statement.functionName}' automatically generated by EngineeringPaper.xyz

    Parameters
    ----------
${statement.parameterNames.map(parameterMap).join("\n")}

    Returns
    -------
    ${isMatrixResult(result) ? "numpy.array" : "float"}
        Return value ${isMatrixResult(result) ? getMatrixUnitsResult(result, userReturnUnits) : getUnitsDescription(userReturnUnits ? userReturnUnits : result.units)}
    """
${statement.parameterNames.map(parameterConversionMap).filter(value => value !== "").map((row, i) => i === 0 ? "\n"+row : row).map(row => row+"\n").join("")}
    result = ${result.generatedCode}

    ${getReturnConversion(userReturnUnits)}
`;

      return finalCode.replaceAll("_as_variable", "");
    }
  }

</script>

<style>
  div.info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-block-end: 10px;
  }
</style>

<div class="info">
  <Information color="blue"/>
  <div>
    Always test the generated code against known values, report issues or errors to 
    <a href="mailto:support@engineeringpaper.xyz">support@engineeringpaper.xyz</a>
  </div>
</div>

{#await pyodidePromise}
  <InlineLoading description="Generating Python Code..."/>
{:then promiseReturn}
  {#if generatedCode}
    <CodeSnippet
      type="multi"
      code={generatedCode}
      expanded
      light={true}
    />
  {/if}
{:catch promiseError}
  <InlineLoading status="error" description={promiseError}/>
{/await}