
// plantillas/relojes_arena.js
export async function render(root, data, hooks){
  const { relojes=[3,5], objetivo=4, pista=null } = data;
  root.innerHTML = `
    <div class="template-box">
      <div class="badge">Relojes de arena</div>
      <p>Tienes relojes de ${relojes.join(' y ')} minutos. ¿Cómo medir <strong>${objetivo}</strong> minutos?</p>
      <textarea id="plan" rows="4" style="width:100%" placeholder="Escribe los pasos (inicia ambos, cuando acabe el de 3...)"></textarea>
      <div class="template-actions">
        <button class="btn" id="btn-comprobar">Hecho</button>
        ${pista ? '<button class="btn" id="btn-pista">Pista</button>' : ''}
      </div>
    </div>`;
  root.querySelector('#btn-comprobar').addEventListener('click', ()=>{
    const ok = (root.querySelector('#plan').value || '').length >= 20; // mínima explicación
    if(ok){ hooks.onSuccess && hooks.onSuccess(); }
    else { root.insertAdjacentHTML('beforeend','<p style="margin-top:10px;color:#ffd23b">Dame un plan un poco más detallado 😉</p>'); }
  });
  if(pista){ root.querySelector('#btn-pista')?.addEventListener('click', ()=> hooks.onHint && hooks.onHint(pista)); }
}
