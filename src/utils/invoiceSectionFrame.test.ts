import assert from 'node:assert/strict';
import { invoiceSectionFrameClass } from './invoiceSectionFrame';

const emptyPrimary = invoiceSectionFrameClass(true, 0);
assert.equal(emptyPrimary.includes('flex-1'), false, 'an empty primary list does not grow');
assert.equal(emptyPrimary.includes('flex-shrink-0'), true);
assert.equal(emptyPrimary.includes('max-h-[40%]'), false);

const filledPrimary = invoiceSectionFrameClass(true, 3);
assert.equal(filledPrimary.includes('flex-1'), true, 'a primary list with rows still fills leftover height');
assert.equal(filledPrimary.includes('max-h-[40%]'), false);

const emptySecondary = invoiceSectionFrameClass(false, 0);
assert.equal(emptySecondary.includes('flex-1'), false);
assert.equal(emptySecondary.includes('flex-shrink-0'), true);
assert.equal(emptySecondary.includes('max-h-[40%]'), true);

const filledSecondary = invoiceSectionFrameClass(false, 8);
assert.equal(filledSecondary.includes('flex-1'), false);
assert.equal(filledSecondary.includes('max-h-[40%]'), true);

console.log('invoiceSectionFrame.test.ts ok');
