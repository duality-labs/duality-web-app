// add Buffer.from support for '@duality-labs/neutronjs'
import { Buffer } from 'buffer';
window.global = window.globalThis;
window.Buffer = Buffer;
