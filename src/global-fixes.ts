// add Buffer.from support for '@duality-labs/dualityjs'
import { Buffer } from 'buffer';
window.global = window.globalThis;
window.Buffer = Buffer;
