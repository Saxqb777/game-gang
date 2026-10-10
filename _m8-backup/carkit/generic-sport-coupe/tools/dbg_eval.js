(() => { const car = window.__car; const w = car.getObjectByName('wheel_fl'); const s = car.getObjectByName('steering_wheel');
 return JSON.stringify({ wm: w.matrix.elements, p: w.position, q: w.quaternion, s: w.scale, ud: w.userData, sp: s.position, sq: s.quaternion, parent: w.parent.name, ptype: w.parent.type, pm: w.parent.matrix.elements }); })()
