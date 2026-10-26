/* eslint-disable import/no-nodejs-modules */
import test from 'node:test';
import * as assert from 'node:assert/strict';
import { selectBestRule } from './mapping.js';

void test('prefers the most specific AND rule', () => {
  const rules = [
    { property: 'type', value: 'project', folder: 'Projects' },
    { property: 'type;status', value: 'project;archived', folder: 'Archive/Projects' },
    { property: 'type;status;category', value: 'project;archived;work', folder: 'Archive/Work/Projects' },
  ];

  const match = selectBestRule({ type: 'project', status: 'archived', category: 'work' }, rules);
  assert.equal(match?.folder, 'Archive/Work/Projects');
});

void test('keeps single-condition rule behavior for older mappings', () => {
  const rules = [
    { property: 'type', value: 'project', folder: 'Projects' },
    { property: 'status', value: 'archived', folder: 'Archive' },
  ];

  const match = selectBestRule({ type: 'project' }, rules);
  assert.equal(match?.folder, 'Projects');
});
