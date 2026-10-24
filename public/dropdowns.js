let dropdownOpen=null,dropdownSerial=0;
function closeDropdown(restore=false){if(!dropdownOpen)return;const old=dropdownOpen;dropdownOpen=null;old.trigger.setAttribute('aria-expanded','false');old.trigger.classList.remove('is-open');old.menu.classList.add('is-closing');old.menu.style.pointerEvents='none';setTimeout(()=>old.menu.remove(),150);if(restore&&old.trigger.isConnected)old.trigger.focus();}
function refreshSelects(){
 if(dropdownOpen&&!dropdownOpen.select.isConnected)closeDropdown();
 document.querySelectorAll('select').forEach(select=>{
  let trigger=select._customTrigger;
  if(!trigger){const shell=document.createElement('span');shell.className='custom-select-shell';shell.dataset.dropdown='';select.before(shell);shell.append(select);select.classList.add('native-select');select.tabIndex=-1;select.setAttribute('aria-hidden','true');trigger=document.createElement('button');trigger.type='button';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');select._customTrigger=trigger;shell.append(trigger);
   trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(dropdownOpen?.select===select)closeDropdown(true);else openDropdown(select)});
   trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();openDropdown(select,e.key==='ArrowUp'?-1:1)}else if(e.key==='Escape')closeDropdown(true)});
  }
  trigger.className='custom-select-trigger '+select.className.replace('native-select','')+(select.id?' control-'+select.id:'');trigger.disabled=select.disabled;
  const label=select.options[select.selectedIndex]?.textContent||'Select';trigger.innerHTML='<span class="dropdown-value">'+esc(label)+'</span><svg class="dropdown-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>';
  const accessible=select.getAttribute('aria-label')||select.labels?.[0]?.childNodes[0]?.textContent?.trim()||'Select';trigger.setAttribute('aria-label',accessible+': '+label);trigger.setAttribute('aria-expanded',String(dropdownOpen?.select===select));
 });
}
function openDropdown(select,direction=1){
 closeDropdown();const trigger=select._customTrigger,menu=document.createElement('div');menu.className='dropdown-menu';menu.id='dropdown-'+(++dropdownSerial);menu.setAttribute('role','listbox');menu.setAttribute('aria-label',select.getAttribute('aria-label')||'Options');trigger.setAttribute('aria-controls',menu.id);trigger.setAttribute('aria-expanded','true');trigger.classList.add('is-open');
 const options=Array.from(select.options).filter(o=>!o.disabled),buttons=[];
 options.forEach(option=>{const b=document.createElement('button');b.type='button';b.className='dropdown-option';b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.value===select.value));b.tabIndex=-1;const status=select.hasAttribute('data-status')||select.id==='status';b.innerHTML=(status?'<i class="option-dot '+statusClass(option.value)+'"></i>':'')+'<span>'+esc(option.textContent)+'</span><svg class="option-check" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7"/></svg>';
  b.addEventListener('click',e=>{e.stopPropagation();const id=select.id,statusId=select.dataset.status;closeDropdown();select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refreshSelects();const next=id?document.getElementById(id):Array.from(document.querySelectorAll('select[data-status]')).find(s=>s.dataset.status===statusId);next?._customTrigger?.focus()});menu.append(b);buttons.push(b);
 });
 (select.closest('dialog[open]')||document.body).append(menu);dropdownOpen={menu,trigger,select};
 const r=trigger.getBoundingClientRect(),padding=12,width=Math.min(Math.max(r.width,190),window.innerWidth-padding*2);menu.style.width=width+'px';menu.style.maxHeight=Math.min(300,window.innerHeight-32)+'px';const height=menu.getBoundingClientRect().height,below=window.innerHeight-r.bottom-padding;let top=below>=height?r.bottom+8:Math.max(padding,r.top-height-8);menu.style.left=Math.max(padding,Math.min(r.left,window.innerWidth-width-padding))+'px';menu.style.top=top+'px';menu.style.transformOrigin=below>=height?'top':'bottom';
 let index=Math.max(0,options.findIndex(o=>o.value===select.value));if(direction<0&&index===0)index=buttons.length-1;buttons[index]?.focus({preventScroll:true});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeDropdown(true);return}if(e.key==='Tab'){closeDropdown(true);return}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();index=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[index]?.focus();}else if(e.key.length===1&&e.key!==' '){const found=options.findIndex((o,i)=>i!==index&&o.textContent.toLowerCase().startsWith(e.key.toLowerCase()));if(found>=0){index=found;buttons[index].focus();}}});
}
document.addEventListener('pointerdown',e=>{if(dropdownOpen&&!dropdownOpen.menu.contains(e.target)&&!dropdownOpen.trigger.contains(e.target))closeDropdown()});
document.addEventListener('scroll',e=>{if(dropdownOpen&&!dropdownOpen.menu.contains(e.target))closeDropdown()},true);
window.addEventListener('resize',()=>closeDropdown());
document.getElementById('editor').addEventListener('close',()=>closeDropdown());
refreshSelects();
