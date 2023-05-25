import { test, expect } from '@playwright/test';
import { complex, cot, pi, sqrt, tan, cos} from 'mathjs';

import { precision, loadPyodide, newSheet } from './utility.mjs';

let page;

// loading pyodide takes a long time (especially in resource constrained CI environments)
// load page once and use for all tests in this file
test.beforeAll(async ({ browser }) => {page = await loadPyodide(browser, page);} );

// give each test a blank sheet to start with (this doesn't reload pyodide)
test.beforeEach(async () => newSheet(page));


test('Test trigonometric functions', async () => {

  // test trigonometric functions
  await page.type(':nth-match(math-field.editable, 1)', 'cos(1)=');
  await page.waitForSelector('.status-footer', {state: 'detached'});
  let content = await page.textContent('#result-value-0');
  expect(parseFloat(content)).toBeCloseTo(0.540302305868139717400, precision);

  await page.click('#add-math-cell');
  await page.type(':nth-match(math-field.editable, 2)', 'sin(30[degrees])=');
  await page.waitForSelector('.status-footer', {state: 'detached'});
  content = await page.textContent('#result-value-1');
  expect(parseFloat(content)).toBeCloseTo(0.5, precision);

  await page.click('#add-math-cell');
  await page.type(':nth-match(math-field.editable, 3)', 'sin(1[radians])=');
  await page.waitForSelector('.status-footer', {state: 'detached'});
  content = await page.textContent('#result-value-2');
  expect(parseFloat(content)).toBeCloseTo(0.84147098480789650665, precision);

  await page.click('#add-math-cell');
  await page.type(':nth-match(math-field.editable, 4)', 'tan(45[degrees])=');
  await page.waitForSelector('.status-footer', {state: 'detached'});
  content = await page.textContent('#result-value-3');
  expect(parseFloat(content)).toBeCloseTo(1, precision);

  await page.click('#add-math-cell');
  await page.type(':nth-match(math-field.editable, 5)', 'csc(1[sec])=');
  await page.waitForSelector('.status-footer', {state: 'detached'});
  content = await page.textContent('#result-units-4');
  expect(content).toBe('Dimension Error');

  await page.click('#add-math-cell');
  await page.type(':nth-match(math-field.editable, 6)', 'sin(1)=');
  await page.waitForSelector('.status-footer', {state: 'detached'});
  content = await page.textContent('#result-value-5');
  expect(parseFloat(content)).toBeCloseTo(0.841470984807896506652502321630, precision);

});


test('Test cot, deg conversion with trig functions, and precidence with parens', async () => {

  await page.setLatex(0, String.raw`N=34`);
  await page.click('#add-math-cell');
  await page.setLatex(1, String.raw`P=12.7\left[mm\right]`);
  await page.click('#add-math-cell');
  await page.setLatex(2, String.raw`P\cdot \left(\cot \left(\frac{180\left[deg\right]}{N}\right)-1\right)-.762\left[mm\right]=\left[mm\right]`);
  await page.click('#add-math-cell');
  await page.setLatex(3, String.raw`P\cdot \left(0.6+\cot \left(\frac{180\left[deg\right]}{N}\right)\right)=\left[mm\right]`);

  await page.waitForSelector('.status-footer', {state: 'detached'});

  let content = await page.textContent('#result-value-2');
  expect(parseFloat(content)).toBeCloseTo(12.7*(cot(pi/34)-1)-.762, precision-2);
  content = await page.textContent('#result-value-3');
  expect(parseFloat(content)).toBeCloseTo(12.7*(0.6 + cot(pi/34)), precision-2);

});


test('Test inverse trig functions', async () => {

  // check that inverse trig functions only accept unitless input
  await page.setLatex(0, String.raw`arcsin\left(5\left[meters\right]\right)=`);

  // make sure units errors are caught
  await page.click('#add-math-cell');
  await page.setLatex(1, String.raw`arccos\left(.1+.2\left[m\right]\right)=`);

  await page.click('#add-math-cell');
  await page.setLatex(2, String.raw`arctan\left(1\right)=\left[deg\right]`);

  await page.click('#add-math-cell');
  await page.setLatex(3, String.raw`\arcsin\left(-\frac{\sqrt{3}\cdot 1\left[m\right]}{2000\left[mm\right]}\right)=`);

  await page.click('#add-math-cell');
  await page.setLatex(4, String.raw`\arccos\left(\frac{1\left[mile\right]}{2\left[mile\right]}+0\right)=\left[deg\right]`);

  await page.waitForSelector('.status-footer', {state: 'detached'});

  // make sure dimension errors are indicated
   await page.locator('#cell-0 >> text=Dimension Error').waitFor({state: 'attached', timeout: 1000});
   await page.locator('#cell-1 >> text=Dimension Error').waitFor({state: 'attached', timeout: 1000});


  let content = await page.textContent('#result-value-2');
  expect(parseFloat(content)).toBeCloseTo(45, precision);
  content = await page.textContent('#result-units-2');
  expect(content).toBe('deg');

  content = await page.textContent('#result-value-3');
  expect(parseFloat(content)).toBeCloseTo(-pi/3, precision);
  content = await page.textContent('#result-units-3');
  expect(content).toBe('rad');

  content = await page.textContent('#result-value-4');
  expect(parseFloat(content)).toBeCloseTo(60, precision-1);
  content = await page.textContent('#result-units-4');
  expect(content).toBe('deg');

});


test('Test min/max functions', async ({ browserName }) => {

  // Change title
  await page.locator('math-field.editable').nth(0).type('x=');
  await page.locator('text=f(x)').click();
  await page.locator('text=min').nth(0).click();
  await page.locator('math-field.editable').nth(0).type('s,t,-1[mm/s');
  await page.locator('math-field.editable').nth(0).press('ArrowRight');
  await page.locator('math-field.editable').nth(0).type(']');

  await page.locator('#add-math-cell').click();
  await page.locator('math-field.editable').nth(1).type('2*');
  await page.locator('text=max').nth(0).click();
  await page.locator('math-field.editable').nth(1).type('-y/z');
  await page.locator('math-field.editable').nth(1).press('ArrowRight');
  await page.locator('math-field.editable').nth(1).type(',x');
  await page.locator('math-field.editable').nth(1).press('ArrowRight');
  await page.locator('math-field.editable').nth(1).type('=');

  await page.locator('#add-math-cell').click();
  await page.setLatex(2, 'y=10\\left[mm\\right]');

  await page.locator('#add-math-cell').click();
  await page.setLatex(3, 'z=5\\left[sec\\right]');

  await page.locator('#add-math-cell').click();
  await page.setLatex(4, 's=2\\left[\\frac{m}{sec}\\right]');

  await page.locator('#add-math-cell').click();
  await page.setLatex(5, 't=2\\left[\\frac{miles}{hour}\\right]');

  await page.waitForSelector('.status-footer', { state: 'detached'});
  let content = await page.locator('#result-value-1').textContent();
  expect(parseFloat(content)).toBeCloseTo(-.002, precision);
  content = await page.locator('#result-units-1').textContent();
  expect(content).toBe('m^1*sec^-1');

  await page.setLatex(2, 'y=-10\\left[mm\\right]');

  await page.waitForSelector('.status-footer', { state: 'detached' });
  content = await page.locator('#result-value-1').textContent();
  expect(parseFloat(content)).toBeCloseTo(.004, precision);

  await page.locator('#add-math-cell').click();
  await page.locator('math-field.editable').nth(6).type('max(-20,-10,-100)=');

  await page.locator('#add-math-cell').click();
  await page.locator('math-field.editable').nth(7).type('min(-1)=');

  await page.locator('#add-math-cell').click();
  await page.locator('math-field.editable').nth(8).type('min(-1, 10[inches])=');

  await page.locator('#add-math-cell').click();
  await page.locator('math-field.editable').nth(9).type('max(-1[feet], 10[inches])=[sec]');

  await page.waitForSelector('.status-footer', { state: 'detached' });
  content = await page.locator('#result-value-6').textContent();
  expect(parseFloat(content)).toBeCloseTo(-10, precision);

  content = await page.locator('#result-value-7').textContent();
  expect(parseFloat(content)).toBeCloseTo(-1, precision);

  content = await page.textContent('#result-units-8');
  expect(content).toBe('Dimension Error');

  content = await page.textContent('#result-units-9');
  expect(content).toBe('Units Mismatch');

  await page.locator('#add-math-cell').click();
  await page.locator('math-field.editable').nth(10).type('1[Pa]*min(0,x2)+1[N]=');

  await page.locator('#add-math-cell').click();
  await page.locator('math-field.editable').nth(11).type('1[N]*min(0,x2)+1[N]=');

  await page.locator('#add-math-cell').click();
  await page.locator('math-field.editable').nth(12).type('1[Pa]*min(0,0)+1[N]=');

  await page.locator('#add-math-cell').click();
  await page.setLatex(13, 'x2=-1\\left[\\frac{m}{m}\\right]')

  await page.waitForSelector('.status-footer', { state: 'detached' });
  content = await page.locator('#result-units-10').textContent();
  expect(content).toBe('Dimension Error');

  content = await page.locator('#result-units-11').textContent();
  expect(content).toBe('N');

  content = await page.locator('#result-units-12').textContent();
  expect(content).toBe('N');

});