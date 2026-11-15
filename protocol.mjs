// Headless protocol test: two real WebSocket clients exercise the server rules.
import WebSocket from 'ws';
const URL = process.env.URL || 'ws://localhost:8080/ws'; // run the server with TM_DEBUG=1 (npm run dev)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function client(name) {
  const ws = new WebSocket(URL); const evs = []; let last = null;
  ws.on('message', d => { const m = JSON.parse(d); if (m.type === 'state') last = m; else evs.push(m); });
  return { ws, evs, get state() { return last; }, send: (m) => ws.send(JSON.stringify(m)),
    open: () => new Promise(r => ws.on('open', r)), find: (f) => evs.find(f) };
}
const assert = (c, msg) => { if (!c) { console.error('FAIL', msg); process.exit(1); } console.log('ok -', msg); };
const A = client('A'), B = client('B');
await Promise.all([A.open(), B.open()]);
A.send({ type: 'create', char: 'omar' }); await sleep(200);
const code = A.find(m => m.type === 'joined').code; assert(/^[A-Z2-9]{5}$/.test(code), 'invite code ' + code);
B.send({ type: 'join', code }); await sleep(200);
assert(B.find(m => m.type === 'joined')?.you === 'shorok', 'joiner is Shorok');
A.send({ type: 'start' }); await sleep(300);
assert(A.find(m => m.ev === 'round'), 'round started');
// Shorok rigs the fake spider at the desk while Omar is in the kitchen
A.send({ type: 'pos', x: 1, z: -5, r: 0, a: 'idle', tp: 1 });
B.send({ type: 'pos', x: -9.5, z: -6.3, r: 0, a: 'idle', tp: 1 }); await sleep(200);
B.send({ type: 'prep_start', prank: 'fake_spider' }); await sleep(2300);
B.send({ type: 'prep_done' }); await sleep(250);
assert(B.find(m => m.ev === 'armed'), 'trap armed for Shorok');
assert(!A.find(m => m.ev === 'armed'), 'Omar did NOT receive trap info (secret)');
assert(B.state.you.traps.length === 1, 'Shorok sees 1 armed trap');
// Omar walks to the desk and uses the computer
A.send({ type: 'pos', x: -9.5, z: -6.3, r: 0, a: 'walk', tp: 1 }); await sleep(200);
A.send({ type: 'interact', hs: 'desk_pc' }); await sleep(250);
const pa = A.find(m => m.ev === 'prank'), pb = B.find(m => m.ev === 'prank');
assert(pa && pb && pa.prank === 'fake_spider' && pa.victim === 'omar', 'prank event synced to both');
assert(B.state.players.shorok.score >= 150 + 20 + 25, 'Shorok score ' + B.state.players.shorok.score);
assert(A.state.players.omar.stunned, 'Omar stunned');
// Catch: Omar prepares rocket at stove while Shorok stands next to him
await sleep(2600);
A.send({ type: 'pos', x: -1.3, z: -7.0, r: 0, a: 'idle', tp: 1 });
B.send({ type: 'pos', x: -2.5, z: -6.5, r: 0, a: 'idle', tp: 1 }); await sleep(200);
A.send({ type: 'prep_start', prank: 'toy_rocket' }); await sleep(400);
assert(A.find(m => m.ev === 'caught' && m.who === 'omar'), 'Omar caught preparing next to Shorok');
// Defuse: Omar rigs whoopee cushion unseen; Shorok searches the sofa
A.send({ type: 'pos', x: 7.9, z: -3.2, r: 0, a: 'idle', tp: 1 });
B.send({ type: 'pos', x: -10, z: 4, r: 0, a: 'idle', tp: 1 }); await sleep(200);
A.send({ type: 'prep_start', prank: 'whoopee' }); await sleep(1900); A.send({ type: 'prep_done' }); await sleep(200);
A.send({ type: 'pos', x: 1, z: -5, r: 0, a: 'idle', tp: 1 });
B.send({ type: 'pos', x: 7.9, z: -3.2, r: 0, a: 'idle', tp: 1 }); await sleep(200);
B.send({ type: 'search', hs: 'sofa' }); await sleep(200);
assert(A.find(m => m.ev === 'defused' && m.by === 'shorok'), 'Shorok defused the whoopee cushion');
// Remote miss + distract
B.send({ type: 'distract', room: 'bathroom' }); await sleep(200);
assert(A.find(m => m.ev === 'lure' && m.room === 'bathroom'), 'Omar got lured to bathroom');
// Pause
A.send({ type: 'pause', on: true }); await sleep(200);
assert(B.state.paused, 'pause synced');
A.send({ type: 'pause', on: false }); await sleep(200);
// Reconnect: Shorok drops and resumes with token
const tok = B.find(m => m.type === 'joined').token; B.ws.close(); await sleep(300);
assert(A.state.paused && A.state.pauseReason === 'disconnect', 'match paused on disconnect');
const C = client('C'); await C.open(); C.send({ type: 'resume', token: tok }); await sleep(300);
assert(C.find(m => m.type === 'joined')?.you === 'shorok', 'Shorok resumed');
assert(!A.state.paused, 'match resumed after reconnect');
console.log('scores', A.state.players.omar.score, A.state.players.shorok.score);
console.log('ALL PROTOCOL TESTS PASSED'); process.exit(0);
