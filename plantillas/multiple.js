
// plantillas/multiple.js
export async function render(root, data, hooks){
  const { pregunta='Elige la opción correcta', opciones=[], correcta=0, pista=null } = data;
  root.innerHTML = `
    <div class="template-box">
      <div class="badge">Elección múltiple</div>
      <p style="margin:6px 0 10px 0">${pregunta}</p>
      <div class="template-actions" id="opts"></div>
      ${pista ? '<button class="btn" id="btn-pista">Pista</button>' : ''}
    </div>`;
  const opts = root.querySelector('#opts');
  opciones.forEach((txt, idx)=>{
    const b = document.createElement('button');
    b.className='btn'; b.textContent = txt; b.addEventListener('click', ()=>sel(idx));
    opts.appendChild(b);
  });
  if(pista){ root.querySelector('#btn-pista').addEventListener('click', ()=>hooks.onHint && hooks.onHint(pista)); }
  function sel(i){
    [...opts.children].forEach(el=>el.disabled=true);
    if(i===correcta){
      root.querySelector('.template-box').classList.add('template-success');
      hooks.onSuccess && hooks.onSuccess();
    } else {
      root.insertAdjacentHTML('beforeend', '<p style="margin-top:10px;color:#ffd23b">No es esa. Prueba otra idea.</p>');
    }
  }
}
