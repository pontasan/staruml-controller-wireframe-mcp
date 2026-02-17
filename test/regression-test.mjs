#!/usr/bin/env node
import { apiGet, apiPost, apiDelete, encId, runTest } from './test-utils.mjs';

const DIR = import.meta.dirname;

await runTest('wireframe', DIR, async (ctx) => {
  // Create wireframe diagram
  let s = ctx.step('Create wireframe diagram');
  let diagramId;
  try {
    const res = await apiPost('/api/wireframe/diagrams', { name: 'Test Wireframe' });
    diagramId = res.data._id;
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  // Create web frame
  s = ctx.step('Create web frame (Login Page)');
  let frameModelId;
  try {
    const res = await apiPost('/api/wireframe/frames', { diagramId, type: 'WFWebFrame', name: 'Login Page', x1: 50, y1: 50, x2: 400, y2: 500 });
    frameModelId = res.data._id;
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  // Get frame view ID for tailViewId
  s = ctx.step('Get frame view ID');
  let frameViewId;
  try {
    const res = await apiGet(`/api/diagrams/${encId(diagramId)}/views`);
    const frameView = res.data.find(v => v.modelId === frameModelId);
    if (!frameView) throw new Error('Frame view not found in diagram views');
    frameViewId = frameView._id;
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  // Create widgets inside frame
  s = ctx.step('Create text (Title)');
  try {
    await apiPost('/api/wireframe/widgets', { diagramId, type: 'WFText', name: 'Login', tailViewId: frameViewId, x1: 150, y1: 100, x2: 300, y2: 130 });
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  s = ctx.step('Create input (Username)');
  try {
    await apiPost('/api/wireframe/widgets', { diagramId, type: 'WFInput', name: 'Username', tailViewId: frameViewId, x1: 100, y1: 160, x2: 350, y2: 190 });
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  s = ctx.step('Create input (Password)');
  try {
    await apiPost('/api/wireframe/widgets', { diagramId, type: 'WFInput', name: 'Password', tailViewId: frameViewId, x1: 100, y1: 220, x2: 350, y2: 250 });
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  s = ctx.step('Create checkbox (Remember me)');
  try {
    await apiPost('/api/wireframe/widgets', { diagramId, type: 'WFCheckbox', name: 'Remember me', tailViewId: frameViewId, checked: false, x1: 100, y1: 280, x2: 250, y2: 310 });
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  s = ctx.step('Create button (Login)');
  try {
    await apiPost('/api/wireframe/widgets', { diagramId, type: 'WFButton', name: 'Login', tailViewId: frameViewId, x1: 150, y1: 340, x2: 300, y2: 380 });
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  s = ctx.step('Create link (Forgot Password)');
  try {
    await apiPost('/api/wireframe/widgets', { diagramId, type: 'WFLink', name: 'Forgot Password?', tailViewId: frameViewId, x1: 150, y1: 410, x2: 300, y2: 440 });
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }

  await ctx.exportDiagram(diagramId, 'Export wireframe image');

  s = ctx.step('Delete diagram');
  try {
    await apiDelete(`/api/wireframe/diagrams/${encId(diagramId)}`);
    s.pass();
  } catch (e) { s.fail(e.message); throw e; }
});
