export async function render(root,data,hooks){
  const {jarras=[3,5],objetivo=4,pista=null}=data||{};
  root.innerHTML=`<div class="template-box"><div class="badge">Jarras exactas</div><p>Con jarras de ${jarras.join(' y ')} L, consigue <strong>${objetivo}</strong> L exactos.</p></div>`;
}
