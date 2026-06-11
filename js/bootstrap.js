// js/bootstrap.js — Lightweight boot module
// Loads minimal data for initial render, then kicks off app.js
// Can eventually replace the <script> tags in index.html

import { bootLoader } from './core/data.js';

// Start loading data immediately (non-blocking)
const dataPromise = bootLoader();

// Export the promise so app.js can await it if needed
export default dataPromise;