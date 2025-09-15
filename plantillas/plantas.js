export async function render(root, data, hooks){
  const cfg = data?.json_url ? await (await fetch(data.json_url,{cache:'no-cache'})).json() : (data||{});
  const cycles = cfg.cycles||6; const plants = cfg.plants||[{id:'A',doses:3},{id:'B',doses:2}]; const K=cfg.capacity_per_cycle||2;
  const grid = plants.map(()=> Array(cycles).fill(false));
  root.innerHTML = `<div class="template-box" id="plantas">
  <div class="badge">Plantas · Riegos secuenciados</div>
  <div id="grid"></div>
  <div id="panel"></div>
  <div class="feedback" id="status"></div>
  </div>`;
  const host=root.querySelector('#grid'); const panel=root.querySelector('#panel'); const status=root.querySelector('#status');
  function dosesByPlant(i){ return grid[i].reduce((a,b)=>a+(b?1:0),0); }
  function dosesByCycle(j){ return grid.reduce((a,row)=>a+(row[j]?1:0),0); }
  function validate(){ let ok=true, exact=true, msgs=[]; for(let j=0;j<cycles;j++){ const dc=dosesByCycle(j); if(dc>K){ ok=false; msgs.push(`Capacidad superada en ciclo ${j+1} (${dc}>${K})`);} } plants.forEach((p,i)=>{ const got=dosesByPlant(i); if(got>p.doses){ ok=false; exact=false; msgs.push(`Exceso en planta ${p.id} (${got}/${p.doses})`);} if(got<p.doses) exact=false; }); return {ok,exact,msgs}; }
  function render(){ const v=validate(); host.innerHTML=''; const table=document.createElement('table'); table.className='table'; const thead=document.createElement('thead'); const trh=document.createElement('tr'); trh.innerHTML='<th>Planta</th>'+Array.from({length:cycles},(_,j)=>`<th>C${j+1}</th>`).join('')+'<th>Total</th>'; thead.appendChild(trh); table.appendChild(thead); const tbody=document.createElement('tbody'); plants.forEach((p,i)=>{ const tr=document.createElement('tr'); const left=document.createElement('td'); left.textContent=p.id; tr.appendChild(left); for(let j=0;j<cycles;j++){ const td=document.createElement('td'); td.className='cell'+(grid[i][j]?' on':''); td.onclick=()=>{ grid[i][j]=!grid[i][j]; render(); }; tr.appendChild(td);} const right=document.createElement('td'); right.textContent=dosesByPlant(i); tr.appendChild(right); tbody.appendChild(tr); }); const trTot=document.createElement('tr'); trTot.innerHTML='<td>Total</td>'+Array.from({length:cycles},(_,j)=>dosesByCycle(j)).map(v=>`<td>${v}</td>`).join('')+'<td></td>'; tbody.appendChild(trTot); table.appendChild(tbody); host.appendChild(table); if(v.exact&&v.ok){ status.textContent='Válido'; status.className='feedback ok'; } else if(!v.ok){ status.textContent='Hay violaciones'; status.className='feedback ko'; } else { status.textContent='Aún incompleto'; status.className='feedback'; } panel.innerHTML = plants.map((p,i)=>`${p.id}: ${dosesByPlant(i)}/${p.doses}`).join(' · '); }
  render();
}
