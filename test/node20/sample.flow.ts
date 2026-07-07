// Imported by its compiled `.js` name though the file on disk is greeting.ts —
// exercises the `.js`->`.ts` extension aliasing that every loader strategy
// (Bun native, sync-alias hook, oxc-node) must provide.
import { greeting } from "./greeting.js";

// Typed local — another construct that must be stripped to run on Node 20.
const name: string = greeting;

export default { name };
