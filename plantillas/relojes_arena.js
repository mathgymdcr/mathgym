export async function render(root,data,hooks){
  const {relojes=[3,5],objetivo=4,pista=null}=data||{};
  root.innerHTML=`<div class="template-box"><div class="badge">Relojes de arena</div><p>Tienes relojes de ${relojes.join(' y ')} min. ¿Cómo medir <strong>${objetivo}</strong> min?</p></div>`;
}
