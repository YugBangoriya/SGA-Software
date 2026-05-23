import { useState } from "react";

const C = {
  primary: "#661F1F", primaryMed: "#8B3A3A",
  appBg: "#CDCBC9", cardBg: "#F5F0EE", taupe: "#E8E2DF",
  textMain: "#222222", textSub: "#666666", white: "#FFFFFF",
  green: "#1A7A1A", amber: "#CC6600", red: "#CC0000", blue: "#0055CC",
  darkAppBg: "#1A1A1A", darkCard: "#2A2A2A", darkElevated: "#3A3A3A",
  darkText: "#E8E8E8", darkSub: "#999999",
};

const SEED = [
  { id: "c1", name: "Maruti Suzuki", models: [
    { id: "m1", name: "Swift", driveLink: "https://drive.google.com/drive/folders/example1", reelLinks: ["https://www.instagram.com/reel/ABC123/", "https://www.instagram.com/reel/DEF456/"] },
    { id: "m2", name: "Ertiga", driveLink: "https://drive.google.com/drive/folders/example2", reelLinks: ["https://www.instagram.com/reel/GHI789/"] },
  ]},
  { id: "c2", name: "Tata", models: [
    { id: "m3", name: "Nexon", driveLink: "", reelLinks: ["https://www.instagram.com/reel/JKL012/"] },
    { id: "m4", name: "Tiago", driveLink: "https://drive.google.com/drive/folders/example3", reelLinks: [] },
  ]},
  { id: "c3", name: "Hyundai", models: [
    { id: "m5", name: "i20", driveLink: "https://drive.google.com/drive/folders/example4", reelLinks: ["https://www.instagram.com/reel/MNO345/", "https://www.instagram.com/reel/PQR678/"] },
  ]},
];

const gid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

function genMsg(co, model) {
  const lines = [`🚗 *${co} ${model.name} — CNG Kit Details*`, "",
    `Namaste! Here are the images and videos for the *${co} ${model.name}* CNG installation by Shree Ganesh Automobile. 🙏`, ""];
  if (model.driveLink) { lines.push("📷 *Installation Images (Google Drive):*"); lines.push(model.driveLink); lines.push(""); }
  if (model.reelLinks?.length) { lines.push("🎬 *Installation Videos (Instagram Reels):*"); model.reelLinks.forEach((r,i)=>lines.push(`${i+1}. ${r}`)); lines.push(""); }
  lines.push("Feel free to contact us for pricing and booking! 😊\n— Shree Ganesh Automobile");
  return lines.join("\n");
}

function Tab({label,active,onClick,isDark}){
  return <button onClick={onClick} style={{padding:"10px 18px",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,background:active?C.primary:"transparent",color:active?C.white:isDark?C.darkSub:C.textSub,borderBottom:active?`3px solid ${C.primaryMed}`:"3px solid transparent",transition:"all 0.2s"}}>{label}</button>;
}

// ── ADMIN SCREEN ───────────────────────────────────────────────────────────────
function AdminScreen({isDark}){
  const [companies,setCompanies]=useState(SEED.map(c=>({...c,models:[...c.models]})));
  const [expandedCo,setExpandedCo]=useState("c1");
  const [expandedMo,setExpandedMo]=useState(null);
  const [addingCo,setAddingCo]=useState(false);
  const [newCoName,setNewCoName]=useState("");
  const [editingCo,setEditingCo]=useState(null);
  const [editCoName,setEditCoName]=useState("");
  const [addingMoFor,setAddingMoFor]=useState(null);
  const [newMo,setNewMo]=useState({name:"",driveLink:"",reel:""});
  const [toast,setToast]=useState(null);

  const border=isDark?"#444":C.taupe, text=isDark?C.darkText:C.textMain, sub=isDark?C.darkSub:C.textSub, card=isDark?C.darkCard:C.cardBg;

  const showToast=(msg,err)=>{setToast({msg,err});setTimeout(()=>setToast(null),2200);};
  const totalMo=companies.reduce((a,c)=>a+c.models.length,0);
  const totalR=companies.reduce((a,c)=>a+c.models.reduce((b,m)=>b+(m.reelLinks?.length||0),0),0);

  const addCo=()=>{if(!newCoName.trim())return;setCompanies(p=>[...p,{id:gid(),name:newCoName.trim(),models:[]}]);setNewCoName("");setAddingCo(false);showToast("Company added ✓");};
  const delCo=(id)=>{setCompanies(p=>p.filter(c=>c.id!==id));showToast("Deleted","err");};
  const saveCo=()=>{if(!editCoName.trim())return;setCompanies(p=>p.map(c=>c.id===editingCo?{...c,name:editCoName.trim()}:c));setEditingCo(null);showToast("Updated ✓");};
  const addMo=(coId)=>{if(!newMo.name.trim())return;const m={id:gid(),name:newMo.name.trim(),driveLink:newMo.driveLink.trim(),reelLinks:newMo.reel.trim()?[newMo.reel.trim()]:[]};setCompanies(p=>p.map(c=>c.id===coId?{...c,models:[...c.models,m]}:c));setNewMo({name:"",driveLink:"",reel:""});setAddingMoFor(null);showToast("Model added ✓");};
  const delMo=(coId,moId)=>{setCompanies(p=>p.map(c=>c.id===coId?{...c,models:c.models.filter(m=>m.id!==moId)}:c));showToast("Deleted","err");};

  return (
    <div style={{fontFamily:"Inter,sans-serif",position:"relative"}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      {toast&&<div style={{position:"fixed",top:20,right:20,zIndex:999,background:toast.err?C.red:C.green,color:C.white,padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:700,boxShadow:"0 4px 16px rgba(0,0,0,0.2)",animation:"fadeIn 0.3s ease"}}>{toast.msg}</div>}

      {/* Notification banner */}
      <div style={{background:isDark?"#2A1A00":"#FFF8E7",border:`1.5px solid ${isDark?"#5A3A00":"#FFD888"}`,borderRadius:12,padding:"12px 16px",marginBottom:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:16}}>🔔</span>
          <div style={{flex:1}}>
            <div style={{color:C.amber,fontSize:13,fontWeight:700}}>Car flagged from Quotation</div>
            <div style={{color:sub,fontSize:12,marginTop:2}}>Honda · City EV — manually entered during quotation. Add to repository to resolve.</div>
          </div>
          <button style={{padding:"6px 12px",borderRadius:7,border:`1.5px solid ${C.green}`,background:"transparent",color:C.green,fontSize:12,fontWeight:700,cursor:"pointer"}}>✓ Resolve</button>
        </div>
      </div>

      {/* Header actions */}
      <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center"}}>
        <div style={{background:card,borderRadius:10,border:`1px solid ${border}`,padding:"8px 12px",display:"flex",gap:14,flex:1}}>
          {[["Companies",companies.length],["Models",totalMo],["Reels",totalR]].map(([l,v])=>(
            <div key={l}><div style={{color:C.primary,fontSize:18,fontWeight:800}}>{v}</div><div style={{color:sub,fontSize:10,textTransform:"uppercase",letterSpacing:0.5}}>{l}</div></div>
          ))}
        </div>
        <button onClick={()=>setAddingCo(true)} style={{padding:"9px 14px",borderRadius:9,border:"none",background:C.primary,color:C.white,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>+ Add Company</button>
      </div>

      {/* Add company */}
      {addingCo&&<div style={{background:card,borderRadius:12,border:`1.5px solid ${C.primaryMed}`,padding:"14px 16px",marginBottom:12}}>
        <input autoFocus placeholder="e.g. Honda, Kia, MG…" value={newCoName} onChange={e=>setNewCoName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addCo();if(e.key==="Escape")setAddingCo(false);}}
          style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${border}`,background:isDark?C.darkElevated:C.white,color:text,fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAddingCo(false)} style={{flex:1,padding:"8px",borderRadius:7,border:`1.5px solid ${border}`,background:"transparent",color:text,cursor:"pointer"}}>Cancel</button>
          <button onClick={addCo} style={{flex:2,padding:"8px",borderRadius:7,border:"none",background:C.primary,color:C.white,fontWeight:700,cursor:"pointer"}}>Add Company</button>
        </div>
      </div>}

      {/* Company cards */}
      {companies.map(co=>{
        const open=expandedCo===co.id;
        return (
          <div key={co.id} style={{background:card,borderRadius:12,border:`1.5px solid ${border}`,marginBottom:10,overflow:"hidden"}}>
            <div onClick={()=>!editingCo&&setExpandedCo(open?null:co.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",cursor:"pointer"}}>
              <div style={{width:38,height:38,borderRadius:9,background:isDark?"#3A2020":"#F5D0D0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏭</div>
              {editingCo===co.id
                ?<div style={{flex:1,display:"flex",gap:8}} onClick={e=>e.stopPropagation()}>
                  <input autoFocus value={editCoName} onChange={e=>setEditCoName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveCo();}}
                    style={{flex:1,padding:"7px 10px",borderRadius:7,border:`1.5px solid ${C.primaryMed}`,background:isDark?C.darkElevated:C.white,color:text,fontSize:14,fontWeight:700,outline:"none"}}/>
                  <button onClick={saveCo} style={{padding:"7px 12px",borderRadius:7,border:"none",background:C.primary,color:C.white,fontWeight:700,cursor:"pointer",fontSize:12}}>Save</button>
                  <button onClick={()=>setEditingCo(null)} style={{padding:"7px 10px",borderRadius:7,border:`1.5px solid ${border}`,background:"transparent",color:text,cursor:"pointer",fontSize:12}}>✕</button>
                </div>
                :<>
                  <div style={{flex:1}}>
                    <div style={{color:text,fontSize:15,fontWeight:700}}>{co.name}</div>
                    <div style={{color:sub,fontSize:11}}>{co.models.length} model{co.models.length!==1?"s":""}</div>
                  </div>
                  <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>{setEditingCo(co.id);setEditCoName(co.name);}} style={{padding:"5px 10px",borderRadius:6,border:`1.5px solid ${C.primaryMed}`,background:"transparent",color:C.primaryMed,fontSize:11,fontWeight:700,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>delCo(co.id)} style={{width:28,height:28,borderRadius:6,border:"none",background:"#FFEBEE",color:C.red,fontSize:13,cursor:"pointer"}}>🗑</button>
                  </div>
                  <span style={{color:sub,transform:open?"rotate(180deg)":"none",transition:"0.2s"}}>▾</span>
                </>}
            </div>

            {open&&<div style={{borderTop:`1px solid ${border}`,padding:"12px 16px"}}>
              {co.models.map(mo=>{
                const mopen=expandedMo===mo.id;
                return <div key={mo.id} style={{background:isDark?"#333":"#FAF7F5",borderRadius:9,border:`1px solid ${isDark?"#444":"#EDE8E5"}`,marginBottom:8,overflow:"hidden"}}>
                  <div onClick={()=>setExpandedMo(mopen?null:mo.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",cursor:"pointer"}}>
                    <span style={{fontSize:16}}>🚗</span>
                    <div style={{flex:1}}>
                      <div style={{color:text,fontSize:13,fontWeight:600}}>{mo.name}</div>
                      <div style={{color:sub,fontSize:11}}>{mo.driveLink?"📷 ":""}{mo.reelLinks?.length?`🎬 ${mo.reelLinks.length} reel${mo.reelLinks.length!==1?"s":""}`:""}{!mo.driveLink&&!mo.reelLinks?.length?"No media":""}</div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();delMo(co.id,mo.id);}} style={{width:26,height:26,borderRadius:6,border:"none",background:"#FFEBEE",color:C.red,fontSize:12,cursor:"pointer"}}>🗑</button>
                    <span style={{color:sub,fontSize:13,transform:mopen?"rotate(180deg)":"none",transition:"0.2s"}}>▾</span>
                  </div>
                  {mopen&&<div style={{borderTop:`1px solid ${isDark?"#444":"#EDE8E5"}`,padding:"10px 12px",background:isDark?C.darkCard:C.white}}>
                    {mo.driveLink&&<div style={{marginBottom:8}}><div style={{color:sub,fontSize:10,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>📷 Google Drive</div><a href={mo.driveLink} target="_blank" rel="noreferrer" style={{color:C.blue,fontSize:12,wordBreak:"break-all"}}>{mo.driveLink}</a></div>}
                    {mo.reelLinks?.length>0&&<div><div style={{color:sub,fontSize:10,fontWeight:700,textTransform:"uppercase",marginBottom:6}}>🎬 Instagram Reels</div>{mo.reelLinks.map((r,i)=><div key={i} style={{marginBottom:4}}><a href={r} target="_blank" rel="noreferrer" style={{color:"#6A1B9A",fontSize:12}}>{r}</a></div>)}</div>}
                    {!mo.driveLink&&!mo.reelLinks?.length&&<div style={{color:sub,fontSize:13}}>No media links added yet.</div>}
                  </div>}
                </div>;
              })}

              {addingMoFor===co.id
                ?<div style={{background:isDark?"#333":C.white,borderRadius:9,border:`1.5px solid ${C.primaryMed}`,padding:"12px",marginTop:8}}>
                  <div style={{color:text,fontSize:13,fontWeight:700,marginBottom:10}}>Add Model to {co.name}</div>
                  {[["name","Model Name *",false],["driveLink","Google Drive Link",false],["reel","Instagram Reel Link 1",false]].map(([k,ph])=>(
                    <input key={k} placeholder={ph} value={newMo[k]} onChange={e=>setNewMo(p=>({...p,[k]:e.target.value}))}
                      style={{width:"100%",padding:"8px 10px",borderRadius:7,border:`1.5px solid ${border}`,background:isDark?C.darkElevated:C.white,color:text,fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:8,fontFamily:"Inter,sans-serif"}}/>
                  ))}
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setAddingMoFor(null)} style={{flex:1,padding:"8px",borderRadius:7,border:`1.5px solid ${border}`,background:"transparent",color:text,cursor:"pointer",fontSize:12}}>Cancel</button>
                    <button onClick={()=>addMo(co.id)} style={{flex:2,padding:"8px",borderRadius:7,border:"none",background:C.primary,color:C.white,fontWeight:700,cursor:"pointer",fontSize:12}}>Add Model</button>
                  </div>
                </div>
                :<button onClick={()=>setAddingMoFor(co.id)} style={{width:"100%",marginTop:8,padding:"9px",borderRadius:9,border:`1.5px dashed ${C.primary}`,background:"transparent",color:C.primary,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ Add Model to {co.name}</button>}
            </div>}
          </div>
        );
      })}
    </div>
  );
}

// ── BROWSER SCREEN ────────────────────────────────────────────────────────────
function BrowserScreen({isDark}){
  const [expanded,setExpanded]=useState("c1");
  const [mExpanded,setMExpanded]=useState(null);
  const border=isDark?"#444":C.taupe, text=isDark?C.darkText:C.textMain, sub=isDark?C.darkSub:C.textSub, card=isDark?C.darkCard:C.cardBg;
  return (
    <div style={{fontFamily:"Inter,sans-serif"}}>
      <div style={{background:isDark?"#3A2020":"#F5D0D0",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:C.primary}}>👁 <strong>Owner Read-Only View</strong> — Browse only. Contact SuperAdmin to add or edit cars.</div>
      {SEED.map(c=>{
        const open=expanded===c.id;
        return <div key={c.id} style={{background:card,borderRadius:12,border:`1.5px solid ${border}`,marginBottom:10,overflow:"hidden"}}>
          <div onClick={()=>setExpanded(open?null:c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",cursor:"pointer"}}>
            <div style={{width:40,height:40,borderRadius:10,background:isDark?"#3A2020":"#F5D0D0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏭</div>
            <div style={{flex:1}}><div style={{color:text,fontSize:15,fontWeight:700}}>{c.name}</div><div style={{color:sub,fontSize:12}}>{c.models.length} models</div></div>
            <div style={{background:isDark?"#3A2020":"#F5D0D0",color:C.primary,padding:"3px 9px",borderRadius:20,fontSize:12,fontWeight:700}}>{c.models.length}</div>
            <span style={{color:sub,transform:open?"rotate(180deg)":"none",transition:"0.2s"}}>▾</span>
          </div>
          {open&&<div style={{borderTop:`1px solid ${border}`,padding:"12px 16px"}}>
            {c.models.map(m=>{
              const mo=mExpanded===m.id;
              return <div key={m.id} style={{background:isDark?"#333":"#FAF7F5",borderRadius:9,border:`1px solid ${isDark?"#444":"#EDE8E5"}`,marginBottom:8,overflow:"hidden"}}>
                <div onClick={()=>setMExpanded(mo?null:m.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",cursor:"pointer"}}>
                  <span style={{fontSize:18}}>🚙</span>
                  <div style={{flex:1}}>
                    <div style={{color:text,fontSize:13,fontWeight:700}}>{m.name}</div>
                    <div style={{display:"flex",gap:6,marginTop:3}}>
                      {m.driveLink&&<span style={{background:isDark?"#1A3A6A":"#E3F2FD",color:C.blue,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20}}>📷 Drive</span>}
                      {m.reelLinks?.length>0&&<span style={{background:isDark?"#3A1A5A":"#F3E5F5",color:"#6A1B9A",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20}}>🎬 {m.reelLinks.length} Reels</span>}
                    </div>
                  </div>
                  <span style={{color:sub,transform:mo?"rotate(180deg)":"none",transition:"0.2s"}}>▾</span>
                </div>
                {mo&&<div style={{borderTop:`1px solid ${isDark?"#444":"#EDE8E5"}`,padding:"10px 12px",background:isDark?C.darkCard:C.white}}>
                  {m.driveLink&&<div style={{marginBottom:10}}><div style={{color:sub,fontSize:10,fontWeight:700,textTransform:"uppercase",marginBottom:5}}>📷 Google Drive — Images</div><a href={m.driveLink} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:8,background:isDark?"#1A3A6A":"#E3F2FD",color:C.blue,fontSize:13,fontWeight:600,textDecoration:"none"}}>🔗 View {c.name} {m.name} Images</a></div>}
                  {m.reelLinks?.length>0&&<div><div style={{color:sub,fontSize:10,fontWeight:700,textTransform:"uppercase",marginBottom:6}}>🎬 Instagram Reels</div>{m.reelLinks.map((r,i)=><a key={i} href={r} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,background:isDark?"#3A1A5A":"#F3E5F5",color:"#6A1B9A",fontSize:12,fontWeight:600,textDecoration:"none",marginBottom:6}}>▶ Reel {i+1}</a>)}</div>}
                </div>}
              </div>;
            })}
          </div>}
        </div>;
      })}
    </div>
  );
}

// ── QUICKSEND DEMO ────────────────────────────────────────────────────────────
function QuickSendDemo({isDark}){
  const [input,setInput]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [selCo,setSelCo]=useState(null);
  const [preview,setPreview]=useState(null);
  const [chat,setChat]=useState([
    {s:"customer",t:"Hi, do you have CNG for Tata Nexon?"},
    {s:"owner",t:"Yes! Let me send you the details right away."},
  ]);
  const border=isDark?"#444":C.taupe, text=isDark?C.darkText:C.textMain, sub=isDark?C.darkSub:C.textSub, card=isDark?C.darkCard:C.cardBg;

  const slashMatch=input.match(/\/([^\s]*)$/);
  const slashTerm=slashMatch?slashMatch[1]:null;
  const slashResults=slashTerm&&slashTerm.length>0?SEED.flatMap(c=>c.models.filter(m=>m.name.toLowerCase().includes(slashTerm.toLowerCase())||c.name.toLowerCase().includes(slashTerm.toLowerCase())).map(m=>({c,m}))):[];

  const pick=(co,mo)=>{setPreview({msg:genMsg(co.name,mo),co:co.name,mo:mo.name});setInput(input.replace(/\/[^\s]*$/,""));setShowModal(false);setSelCo(null);};
  const send=()=>{const t=preview?preview.msg:input;if(!t.trim())return;setChat(p=>[...p,{s:"owner",t}]);setInput("");setPreview(null);};

  return (
    <div style={{fontFamily:"Inter,sans-serif"}}>
      <div style={{background:isDark?"#3A2020":"#F5D0D0",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:C.primary}}>
        💡 <strong>Try it:</strong> Type <code style={{background:isDark?"#2A1010":"#FDEAEA",padding:"1px 5px",borderRadius:4}}>/swift</code> or <code style={{background:isDark?"#2A1010":"#FDEAEA",padding:"1px 5px",borderRadius:4}}>/nexon</code> in the input, or tap the 🚗 button to open the car selector.
      </div>

      {/* Chat window */}
      <div style={{background:card,borderRadius:12,border:`1.5px solid ${border}`,padding:"12px",marginBottom:10,minHeight:130,maxHeight:200,overflowY:"auto"}}>
        {chat.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.s==="owner"?"flex-end":"flex-start",marginBottom:8}}>
            <div style={{background:m.s==="owner"?isDark?"#3A2020":"#F5D0D0":isDark?"#333":"#F0F0F0",color:m.s==="owner"?C.primary:text,padding:"8px 12px",borderRadius:10,maxWidth:"80%",fontSize:13,lineHeight:1.5,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{m.t}</div>
          </div>
        ))}
      </div>

      {/* Preview */}
      {preview&&<div style={{background:isDark?"#1A3A1A":"#E8F5E9",border:`1.5px solid ${C.green}`,borderRadius:10,padding:"10px 12px",marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{color:C.green,fontSize:11,fontWeight:700}}>📋 {preview.co} {preview.mo} — Message Ready</div>
          <button onClick={()=>setPreview(null)} style={{background:"none",border:"none",color:C.green,cursor:"pointer",fontSize:16}}>✕</button>
        </div>
        <pre style={{color:isDark?"#D0F0D0":"#1A5A1A",fontSize:11,whiteSpace:"pre-wrap",wordBreak:"break-word",margin:0,lineHeight:1.5,maxHeight:120,overflowY:"auto"}}>{preview.msg}</pre>
      </div>}

      {/* Input area */}
      <div style={{position:"relative"}}>
        {slashResults.length>0&&<div style={{position:"absolute",bottom:"100%",left:0,right:0,marginBottom:6,background:isDark?C.darkCard:C.white,border:`1.5px solid ${C.primaryMed}`,borderRadius:10,overflow:"hidden",boxShadow:"0 8px 24px rgba(102,31,31,0.18)",zIndex:50}}>
          <div style={{padding:"6px 12px",background:isDark?"#3A2020":"#F5D0D0"}}><span style={{color:C.primary,fontSize:10,fontWeight:700}}>🚗 {slashResults.length} result{slashResults.length!==1?"s":""}</span></div>
          {slashResults.map(({c,m})=>(
            <div key={m.id} onClick={()=>pick(c,m)} style={{padding:"10px 12px",cursor:"pointer",borderBottom:`1px solid ${border}`,display:"flex",gap:8,alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.background=isDark?"#3A2020":"#F5D0D0"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span>🚗</span>
              <div style={{flex:1,color:text,fontSize:13,fontWeight:600}}>{c.name} · {m.name}</div>
              <span style={{color:sub,fontSize:11}}>↵</span>
            </div>
          ))}
        </div>}

        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <button onClick={()=>setShowModal(true)} title="Car Quick-Send" style={{width:40,height:40,borderRadius:9,border:`1.5px solid ${border}`,background:isDark?C.darkElevated:C.cardBg,color:C.primary,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🚗</button>
          <input placeholder='Message or type "/swift" to quick-send car details…' value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){send();e.preventDefault();}}}
            style={{flex:1,padding:"10px 12px",borderRadius:9,border:`1.5px solid ${border}`,background:isDark?C.darkElevated:C.white,color:text,fontSize:13,fontFamily:"Inter,sans-serif",outline:"none"}}/>
          <button onClick={send} style={{padding:"10px 16px",borderRadius:9,border:"none",background:C.primary,color:C.white,fontSize:13,fontWeight:700,cursor:"pointer"}}>📤</button>
        </div>
      </div>

      {/* Car selector modal */}
      {showModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",zIndex:300}} onClick={()=>{setShowModal(false);setSelCo(null);}}>
        <div onClick={e=>e.stopPropagation()} style={{background:isDark?C.darkCard:C.white,width:"100%",maxHeight:"70vh",borderRadius:"16px 16px 0 0",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,0.3)"}}>
          <div style={{textAlign:"center",padding:"10px 0 0"}}><div style={{width:40,height:4,background:isDark?"#555":"#CCC",borderRadius:2,margin:"0 auto"}}/></div>
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{color:text,fontSize:15,fontWeight:800}}>{selCo?`${selCo.name} — Models`:"🚗 Select Car"}</div>
            <div style={{display:"flex",gap:8}}>
              {selCo&&<button onClick={()=>setSelCo(null)} style={{padding:"6px 10px",borderRadius:7,border:`1.5px solid ${border}`,background:"transparent",color:text,fontSize:11,cursor:"pointer"}}>← Back</button>}
              <button onClick={()=>{setShowModal(false);setSelCo(null);}} style={{width:30,height:30,borderRadius:7,border:"none",background:isDark?C.darkElevated:"#F0F0F0",color:sub,cursor:"pointer"}}>✕</button>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {!selCo?SEED.map(c=>(
              <div key={c.id} onClick={()=>setSelCo(c)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:`1px solid ${border}`,cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=isDark?"#3A2020":"#F5D0D0"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{width:38,height:38,borderRadius:9,background:isDark?"#3A2020":"#F5D0D0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏭</div>
                <div style={{flex:1}}><div style={{color:text,fontSize:14,fontWeight:700}}>{c.name}</div><div style={{color:sub,fontSize:12}}>{c.models.length} models</div></div>
                <span style={{color:sub}}>›</span>
              </div>
            )):selCo.models.map(m=>(
              <div key={m.id} onClick={()=>pick(selCo,m)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:`1px solid ${border}`,cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=isDark?"#3A2020":"#F5D0D0"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{width:38,height:38,borderRadius:9,background:isDark?"#333":"#FAF7F5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🚙</div>
                <div style={{flex:1}}>
                  <div style={{color:text,fontSize:14,fontWeight:700}}>{m.name}</div>
                  <div style={{display:"flex",gap:6,marginTop:3}}>
                    {m.driveLink&&<span style={{background:isDark?"#1A3A6A":"#E3F2FD",color:C.blue,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20}}>📷</span>}
                    {m.reelLinks?.length>0&&<span style={{background:isDark?"#3A1A5A":"#F3E5F5",color:"#6A1B9A",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20}}>🎬 {m.reelLinks.length}</span>}
                  </div>
                </div>
                <div style={{background:C.primary,color:C.white,fontSize:11,fontWeight:700,padding:"5px 10px",borderRadius:7}}>Send</div>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App(){
  const [isDark,setIsDark]=useState(false);
  const [tab,setTab]=useState("admin");
  const bg=isDark?C.darkAppBg:C.appBg;

  return (
    <div style={{background:bg,minHeight:"100vh",fontFamily:"Inter,sans-serif"}}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#661F1F55;border-radius:3px}`}</style>

      {/* Top bar */}
      <div style={{background:C.primary,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(102,31,31,0.3)"}}>
        <div>
          <div style={{color:"#F5D0D0",fontSize:10,letterSpacing:2.5,textTransform:"uppercase"}}>Shree Ganesh Automobile · Phase 6</div>
          <div style={{color:C.white,fontSize:18,fontWeight:800}}>🚗 Car Repository</div>
        </div>
        <button onClick={()=>setIsDark(p=>!p)} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"rgba(255,255,255,0.15)",color:C.white,fontSize:13,cursor:"pointer"}}>{isDark?"☀ Light":"🌙 Dark"}</button>
      </div>

      {/* Tabs */}
      <div style={{background:isDark?"#1F0A0A":"#8B3A3A",display:"flex",borderBottom:`2px solid ${C.primary}`,overflowX:"auto"}}>
        {[["admin","⚙ SuperAdmin View"],["browser","👁 Owner Browser"],["quicksend","🚗 Quick-Send Demo"]].map(([id,label])=>(
          <Tab key={id} label={label} active={tab===id} onClick={()=>setTab(id)} isDark={isDark}/>
        ))}
      </div>

      <div style={{maxWidth:700,margin:"0 auto",padding:"20px 16px"}}>
        {tab==="admin"&&<AdminScreen isDark={isDark}/>}
        {tab==="browser"&&<BrowserScreen isDark={isDark}/>}
        {tab==="quicksend"&&<QuickSendDemo isDark={isDark}/>}
      </div>
    </div>
  );
}
