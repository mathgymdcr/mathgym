
// plantillas/trasvase_ecologico.js
export async function render(root, data, hooks){
  const { jarras=[3,5], objetivo=4, pista=null } = data;
  root.innerHTML = `
    <div class="template-box">
      <div class="badge">Trasvase ecológico</div>
      <p>Tienes jarras de ${jarras.join(' y ')} litros. Consigue <strong>${objetivo}</strong> litros exactos sin desperdiciar agua.</p>
      <div class="template-actions">
        <button class="btn" id="btn-resolver">Marcar como resuelto</button>
        ${pista ? '<button class="btn" id="btn-pista">Pista</button>' : ''}
      </div>
    </div>`;
  root.querySelector('#btn-resolver').addEventListener('click', ()=> hooks.onSuccess && hooks.onSuccess());
  if(pista){ root.querySelector('#btn-pista')?.addEventListener('click', ()=> hooks.onHint && hooks.onHint(pista)); }
}
