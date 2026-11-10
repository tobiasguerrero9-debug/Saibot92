const views=new Set(['intelligence','scanner','journal']);
export function miniAppView(search){
  const value=new URLSearchParams(search).get('view');
  return views.has(value)?value:'intelligence';
}
export function miniAppSearch(search,view){
  if(!views.has(view))throw new Error('Unknown Mini App view');
  const next=new URLSearchParams(search);
  if(view==='intelligence')next.delete('view');else next.set('view',view);
  return next;
}
