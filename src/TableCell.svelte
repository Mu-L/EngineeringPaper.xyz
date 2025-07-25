<script lang="ts">
  import { deltaToMarkdown } from "quill-delta-to-markdown";
  import type { Delta } from "quill";

  import appState from "./stores.svelte";

  import { onMount, tick } from "svelte";

  import type TableCell from "./cells/TableCell.svelte";
  import type { MathField as MathFieldClass } from "./cells/MathField.svelte";

  import MathField from "./MathField.svelte";
  import TextBox from "./TextBox.svelte";
  import DocumentationField from "./DocumentationField.svelte";

  import { TooltipIcon } from "carbon-components-svelte";
  import Error from "carbon-icons-svelte/lib/Error.svelte";
  import Information from "carbon-icons-svelte/lib/Information.svelte";
  import Add from "carbon-icons-svelte/lib/Add.svelte";
  import RowDelete from "carbon-icons-svelte/lib/RowDelete.svelte";
  import ColumnDelete from "carbon-icons-svelte/lib/ColumnDelete.svelte";
  import AddComment from "carbon-icons-svelte/lib/AddComment.svelte";
  import ChatOff from "carbon-icons-svelte/lib/ChatOff.svelte";
  import ShowDataCards from "carbon-icons-svelte/lib/ShowDataCards.svelte";
  import Row from "carbon-icons-svelte/lib/Row.svelte";
  import IconButton from "./IconButton.svelte";

  interface Props {
    index: number;
    tableCell: TableCell;
    insertMathCellAfter: (arg: {detail: {index: number}}) => void;
    insertInsertCellAfter: (arg: {detail: {index: number}}) => void;
    mathCellChanged: () => void;
    triggerSaveNeeded: (pendingMathCellChange?: boolean) => void;
  }

  let {
    index,
    tableCell,
    insertMathCellAfter,
    insertInsertCellAfter,
    mathCellChanged,
    triggerSaveNeeded
  }: Props = $props();

  let numColumns = $derived(tableCell.parameterFields.length);
  let numRows = $derived(tableCell.rowLabels.length);
  let hideUnselected = $derived(tableCell.hideUnselected);
  let hideToolbar = $derived(appState.activeCell !== index);

  let containerDiv: HTMLDivElement;

  export function getMarkdown(centerEquations: boolean) {
    let startDelimiter: string;
    let endDelimiter: string;
    if (centerEquations) {
      startDelimiter = "$$ ";
      endDelimiter = " $$";
    } else {
      startDelimiter = "$";
      endDelimiter = "$ <!-- inline -->";
    }

    const row = tableCell.selectedRow;
    let result = "";

    if (tableCell.rowDeltas.length > 0) {
      result += deltaToMarkdown(tableCell.rowDeltas[row]?.ops ?? "").replaceAll("\n", "\n\n").trimEnd() + "\n\n";
    }

    const columnExpressions = [];

    for (const [col, parameter] of tableCell.parameterFields.entries()) {
      if (tableCell.rhsFields[row][col].latex.replaceAll(/\\:?/g,'').trim() !== "") {
        columnExpressions.push(`${parameter.latex} & = \\quad ${tableCell.rhsFields[row][col].latex} ${tableCell.parameterUnitFields[col].latex}`);
      }
    }

    if (columnExpressions.length > 0) {
      result += `${startDelimiter}\\text{${tableCell.rowLabels[row].label}} \\quad `;

      if (columnExpressions.length > 1) {
        result += ` \\begin{cases} `;

        for (const [col, expression] of columnExpressions.entries()) {
          result += expression;
          if (col < columnExpressions.length - 1) {
            result += " \\\\ ";
          }
        }
        result += " \\end{cases}";
      } else {
        result += columnExpressions[0].replace('& = \\quad', '=');
      }
      
      result = result.trimEnd() + `${endDelimiter} \n\n`;
    }

    return result;
  }

  onMount(() => {
    if (tableCell.rowDeltas.length > 0) {
      tableCell.richTextInstance.setContents(tableCell.rowDeltas[tableCell.selectedRow]);
    }

    if (appState.activeCell === index) {
      focus();
    }
  });

  function focus() {
    if ( containerDiv && containerDiv.parentElement &&
         !containerDiv.parentElement.contains(document.activeElement) ) {
      const mathElement: HTMLTextAreaElement = document.querySelector(`#grid-cell-${index}-0-0 math-field`);
      if (mathElement) {
        mathElement.focus();
      }
    }
  }

  async function handleSelectedRowChange() {
    triggerSaveNeeded(true);
    
    await tableCell.parseTableStatements();
    if (tableCell.rowDeltas.length > 0) {
      (tableCell.richTextInstance as any).setContents(tableCell.rowDeltas[tableCell.selectedRow]);
    }
    
    mathCellChanged();
  }

  function addRowDocumentation() {
    tableCell.addRowDocumentation()
    appState.cells = appState.cells;
  }

  function deleteRowDocumentation() {
    tableCell.deleteRowDocumentation()
    appState.cells = appState.cells;
  }

  function highlightDiv(id: string) {
    const labelElement = document.querySelector(id) as HTMLDivElement | null;
    if (labelElement) {
      labelElement.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(labelElement);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  async function addRow() {
    tableCell.addRow();
    appState.cells = appState.cells;
    await tick();
    highlightDiv(`#row-label-${index}-${numRows-1}`);
  }

  function addColumn() {
    tableCell.addColumn();
    appState.cells[index] = appState.cells[index];

    triggerSaveNeeded();
    mathCellChanged();
  }

  async function deleteRow(rowIndex: number) {
    triggerSaveNeeded(true);

    if (tableCell.deleteRow(rowIndex)) {
      await handleSelectedRowChange();
    } else {
      await tableCell.parseTableStatements();
    }
    
    appState.cells[index] = appState.cells[index];

    mathCellChanged();
  }

  async function deleteColumn(colIndex: number) {
    triggerSaveNeeded(true);
    
    tableCell.deleteColumn(colIndex);
    await tableCell.parseTableStatements();
    appState.cells[index] = appState.cells[index];

    mathCellChanged();
  }
  

  function handleEnter(row: number) {
    if (!hideUnselected) {
      if (row == numRows-1) {
        addRow();
      } else {
        highlightDiv(`#row-label-${index}-${row+1}`)
      }
    }
  }


  async function parseLatex(latex: string, column: number, mathField?: MathFieldClass) {
    triggerSaveNeeded(true);

    if (mathField !== undefined) {
      await mathField.parseLatex(latex);
    } else {
      await tableCell.parseUnitField(latex, column);
    }
    
    await tableCell.parseTableStatements();

    appState.cells[index] = appState.cells[index];

    mathCellChanged();
  }

  $effect( () => {
   if (appState.activeCell === index) {
      focus();
    }
  });
</script>


<style>
  div.container {
    display: grid;
    padding-top: 10px;
    padding-bottom: 10px;
    break-inside: avoid;
  }

  div.item {
    border: solid 1px;
    margin: 0 -1px -1px 0;
    display: flex;
    justify-content: left;
    padding: 7px;
  }

  div.item.math-field {
    display: flex;
    align-items: center;
  }

  div.item.borderless {
    border: none;
  }

  div.row-label {
    align-items: center;
  }

  div.bottom-buttons {
    margin-top: 1px;
  }

  div.delete-columns {
    justify-self: center;
  }

  div.right-buttons {
    margin-left: 1px;
  }

  div.delete-rows {
    align-self: center;
  }

  div.add-row {
    display: flex;
    justify-content: start;
    align-items: flex-start;
  }

  div.item.spread-align-center {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  div.right-justify {
    display: flex;
    justify-content: end;
  }

  input {
    margin: 0px 0px 0px 0px;
  }

  @media print {
    div.item.spread-align-center, div.right-buttons, div.bottom-buttons {
      display: none;
    }
  }

</style>

{#if tableCell.rowDeltas.length > 0}
  <div
    spellcheck={appState.activeCell === index}
  >
    <DocumentationField
      hideToolbar={hideToolbar}
      bind:quill={tableCell.richTextInstance}
      update={(e: {detail: {delta: Delta}}) => {
         tableCell.rowDeltas[tableCell.selectedRow] = e.detail.delta;
         triggerSaveNeeded();
      }}
      shiftEnter={() => insertMathCellAfter({detail: {index: index}})}
      modifierEnter={() => insertInsertCellAfter({detail: {index: index}})}
    />
  </div>
{/if}

<div
  class="container"
  bind:this= {containerDiv}
  spellcheck={appState.activeCell === index}
>
  {#if tableCell.parameterFields}
    {#each tableCell.parameterFields as mathField, j (mathField.id)}
      <div
        class="item math-field"
        id={`parameter-name-${index}-${j}`}
        style="grid-column: {j + 2}; grid-row: 1;"
      >
        <MathField
          editable={true}
          update={(e) => parseLatex(e.latex, j, mathField)}
          shiftEnter={() => insertMathCellAfter({detail: {index: index}})}
          modifierEnter={() => insertInsertCellAfter({detail: {index: index}})}
          mathField={mathField}
          parsingError={mathField.parsingError}
          parsePending={mathField.parsePending}
          bind:this={mathField.element}
          latex={mathField.latex}
        />
        {#if mathField.parsingError && !mathField.parsePending}
          <TooltipIcon direction="right" align="end">
            <span slot="tooltipText">{mathField.parsingErrorMessage}</span>
            <Error class="error"/>
          </TooltipIcon>
        {/if}
      </div>
    {/each}
  {/if}

  {#if tableCell.parameterUnitFields}
    {#each tableCell.parameterUnitFields as mathField, j (mathField.id)}
      <div
        class="item math-field"
        id={`parameter-units-${index}-${j}`}
        style="grid-column: {j + 2}; grid-row: 2;"
      >
        <MathField
          editable={true}
          update={(e) => parseLatex(e.latex, j)}
          shiftEnter={() => insertMathCellAfter({detail: {index: index}})}
          modifierEnter={() => insertInsertCellAfter({detail: {index: index}})}
          mathField={mathField}
          parsingError={mathField.parsingError}
          parsePending={mathField.parsePending}
          bind:this={mathField.element}
          latex={mathField.latex}
        />
        
        {#if mathField.parsingError && !mathField.parsePending}
          <TooltipIcon direction="right" align="end">
            <span slot="tooltipText">{mathField.parsingErrorMessage}</span>
            <Error class="error"/>
          </TooltipIcon>
        {/if}
      </div>
    {/each}
  {/if}


  {#if tableCell.rhsFields}
    {#each tableCell.rhsFields as rowFields, i }

      {#if tableCell.rowLabels}
        {#if tableCell.rowLabels[i]}
          {#if !hideUnselected || i === tableCell.selectedRow}
            <div
              class="item row-label"
              style="grid-column: 1; grid-row: {i+3};"
            >
              <input 
                type="radio"
                id={`row-radio-${index}-${i}`}
                name={`selected_row_${index}`}
                bind:group={tableCell.selectedRow}
                value={i}
                onchange={handleSelectedRowChange}
              >
              <TextBox
                enter={() => handleEnter(i)}
                shiftEnter={() => insertMathCellAfter({detail: {index: index}})}
                modifierEnter={() => insertInsertCellAfter({detail: {index: index}})}
                id={`row-label-${index}-${i}`}
                bind:textContent={tableCell.rowLabels[i].label} 
                oninput={() => triggerSaveNeeded()}
              >
              </TextBox>
            </div>
          {/if}
        {/if}
      {/if}

      {#each rowFields as mathField, j (mathField.id)}
        {#if !hideUnselected || i === tableCell.selectedRow}
          <div
            class="item math-field"
            id={`grid-cell-${index}-${i}-${j}`}
            style="grid-column: {j+2}; grid-row: {i+3};"
          >
            <MathField
              editable={true}
              update={(e) => parseLatex(e.latex, j, mathField)}
              enter={() => handleEnter(i)}
              shiftEnter={() => insertMathCellAfter({detail: {index: index}})}
              modifierEnter={() => insertInsertCellAfter({detail: {index: index}})}
              mathField={mathField}
              parsingError={mathField.parsingError}
              parsePending={mathField.parsePending}
              bind:this={mathField.element}
              latex={mathField.latex}
            />
            {#if mathField.parsingError && !mathField.parsePending}
              <TooltipIcon direction="right" align="end">
                <span slot="tooltipText">{mathField.parsingErrorMessage}</span>
                <Error class="error"/>
              </TooltipIcon>
            {/if}
          </div>
        {/if}
      {/each}
    {/each}
  {/if}


  {#if numColumns > 1 && !hideUnselected}
    {#each Array(numColumns) as _, j}
      <div 
        class="bottom-buttons delete-columns"
        style="grid-column: {j + 2}; grid-row: {numRows+3};"
      >
        <IconButton
          click={() => deleteColumn(j)}
          title="Delete Column"
          id={`delete-col-${index}-${j}`}
        >
          <ColumnDelete />
        </IconButton>
      </div>
    {/each}
  {/if}

  {#if numRows > 1 && !hideUnselected}
    {#each Array(numRows) as _, i}
      <div 
        class="right-buttons delete-rows"
        style="grid-column: {numColumns + 2}; grid-row: {i+3};"
      >
        <IconButton
          click={() => deleteRow(i)}
          title="Delete Row"
          id={`delete-row-${index}-${i}`}
        >
          <RowDelete />
        </IconButton>
      </div>
    {/each}
  {/if}


  {#if !hideUnselected}
    <div class="right-buttons" style="grid-column:{numColumns + 2}; grid-row:1">
      <IconButton 
        id={`add-col-${index}`}
        click={addColumn}
        title="Add Column"
      > 
        <Add />
      </IconButton>
    </div>
  {/if}
  <div class="bottom-buttons add-row" style="grid-column:1; grid-row:{numRows + 3}">
    {#if !hideUnselected}
      <IconButton
        click={addRow}
        id={`add-row-${index}`}
        title="Add Row"
      >
        <Add />
      </IconButton>
    {/if}
  </div>

  <div class={`item borderless ${hideUnselected ? 'right-justify': 'spread-align-center'}`}>
    {#if !hideUnselected}
      {#if tableCell.rowDeltas.length === 0}
        <IconButton
          title="Add Row Specific Documentation"
          id={`add-row-docs-${index}`}
          click={addRowDocumentation}
        >
          <AddComment />
        </IconButton>
      {:else}
        <IconButton
          title="Delete All Row Specific Documentation"
          id={`del-row-docs-${index}`}
          click={deleteRowDocumentation}
        >
          <ChatOff />
        </IconButton>
      {/if}
    {/if}

    <TooltipIcon direction="left">
      <span slot="tooltipText">Place variable names in this row</span>
      <Information />
    </TooltipIcon>
  </div>

  <div class={`item borderless ${numRows === 1 ? 'right-justify': 'spread-align-center'}`} style="grid-column:1; grid-row:2">
    {#if numRows > 1}
      {#if hideUnselected}
        <IconButton
          title="Show all rows"
          id={`show-all-rows-${index}`}
          click={() => tableCell.hideUnselected = false}
        >
          <ShowDataCards />
        </IconButton>
      {:else}
        <IconButton
          title="Hide unselected rows"
          id={`hide-unselected-rows-${index}`}
          click={() => tableCell.hideUnselected = true}
        >
          <Row />
        </IconButton>
      {/if}
    {/if}
    
    <TooltipIcon direction="left">
      <span slot="tooltipText">Place column specific units in this row (optional)</span>
      <Information />
    </TooltipIcon>
  </div>

</div>

