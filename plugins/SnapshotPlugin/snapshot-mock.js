/* eslint-disable */
/*
 *  snapshot-mock.js
 *
 *  Vite/Rollup-only ESM module. Activates the mock window and primes fbjs BEFORE
 *  `react-dom/client` is imported — `snapshot-helper-esm.js` imports this module
 *  first, and ES module evaluation is source-ordered, so this runs to completion
 *  (mock window installed) before react-dom loads. Under webpack the CJS
 *  `snapshot-helper.js` does the same via an in-line require order; Rollup hoists
 *  requires, so the ordering is expressed through ESM imports instead.
 */
import ExecutionEnvironment from 'fbjs/lib/ExecutionEnvironment';
import mockWindow from './mock-window.js';

// True while building the snapshot (bare V8: no window, not Node).
export const inSnapshot =
	typeof window === 'undefined' &&
	!(typeof global !== 'undefined' && global.process && global.process.versions && global.process.versions.node);

if (inSnapshot) {
	mockWindow.activate();
	ExecutionEnvironment.canUseDOM = true;
	ExecutionEnvironment.canUseWorkers = false;
	ExecutionEnvironment.canUseEventListeners = true;
	ExecutionEnvironment.canUseViewport = true;
	ExecutionEnvironment.isInWorker = false;
}

export {ExecutionEnvironment, mockWindow};
