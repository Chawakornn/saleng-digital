import {useEffect,useRef,useState} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./pickup.css";

const labels={open:"กำลังหารถในพื้นที่",matched:"ร้านรับงานแล้ว",driving:"รถกำลังเดินทาง",arrived:"รถถึงจุดนัดแล้ว",weighed:"รอผู้ขายยืนยันรับเงิน",done:"ปิดงานแล้ว",cancelled:"ยกเลิกแล้ว"};
const gps=()=>new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(Error("อุปกรณ์นี้ไม่มี GPS"));return;}
  navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,time:p.timestamp}),()=>reject(Error("อ่านตำแหน่งไม่ได้ กรุณาเปิด GPS และอนุญาตตำแหน่ง")), {enableHighAccuracy:true,timeout:20000,maximumAge:15000});
});
async function api(body){
  const r=await fetch("/api/pickup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)throw Error(data.error||"ทำรายการไม่ได้");return data;
}
const pickupIcon=L.divIcon({
  className:"pickup-symbol",iconSize:[28,36],iconAnchor:[14,35],
  html:'<svg viewBox="0 0 28 36" aria-hidden="true"><path d="M14 34S2 21 2 14a12 12 0 1 1 24 0c0 7-12 20-12 20Z" fill="#087858" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="4" fill="white"/></svg>'
});
const truckIcon=L.divIcon({
  className:"pickup-symbol",iconSize:[34,34],iconAnchor:[17,17],
  html:'<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="#294db2" stroke="white" stroke-width="2"/><g fill="none" stroke="white" stroke-width="1.7" stroke-linejoin="round"><path d="M7 11h12v10H7zm12 4h4l4 4v2h-8"/><circle cx="11" cy="22" r="2"/><circle cx="23" cy="22" r="2"/></g></svg>'
});
function MapView({pin,driver,pick}){
  const node=useRef(null),map=useRef(null),markers=useRef({}),click=useRef(pick),lastFrame=useRef("");
  click.current=pick;
  function frame(){
    if(!pin)return;
    const dest=[pin.lat,pin.lng];
    if(driver)map.current.fitBounds([dest,[driver.lat,driver.lng]],{padding:[56,56],maxZoom:16,animate:false});
    else map.current.setView(dest,16,{animate:false});
  }
  useEffect(()=>{
    const m=L.map(node.current,{scrollWheelZoom:false,zoomControl:false}).setView([13.75,100.5],6);
    m.attributionControl.setPrefix(false);
    L.control.zoom({position:"topright",zoomInTitle:"ซูมเข้า",zoomOutTitle:"ซูมออก"}).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'}).addTo(m);
    map.current=m;
    m.on("click",e=>click.current?.({lat:e.latlng.lat,lng:e.latlng.lng}));
    return ()=>{m.remove();markers.current={};lastFrame.current="";};
  },[]);
  useEffect(()=>{
    const m=map.current;
    for(const [key,point,icon,label] of [["pin",pin,pickupIcon,"จุดรับ"],["driver",driver,truckIcon,"รถรับซื้อ"]]){
      const marker=markers.current[key];
      if(!point){marker?.remove();delete markers.current[key];continue;}
      if(marker)marker.setLatLng([point.lat,point.lng]);
      else markers.current[key]=L.marker([point.lat,point.lng],{icon,title:label,alt:label})
        .addTo(m).bindTooltip(label,{direction:"top",offset:[0,key==="pin"?-32:-16]});
    }
    const key=pin?[pin.lat,pin.lng,Boolean(driver)].join(","):"";
    if(key!==lastFrame.current){frame();lastFrame.current=key;}
  },[pin?.lat,pin?.lng,driver?.lat,driver?.lng]);
  return <div className="pickup-map-wrap"><div ref={node} className="pickup-map" aria-label="แผนที่จุดรับและตำแหน่งรถ"/>
    {pin && <button type="button" className="pickup-recenter" onClick={frame}>{driver?"ดูจุดรับและรถ":"กลับไปที่หมุด"}</button>}
  </div>;
}
export function Pickup({user}){
  const buyer=user.role==="buyer",native=window.SalengAndroid;
  const [data,setData]=useState(null),[point,setPoint]=useState(null),[near,setNear]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[webJob,setWebJob]=useState(0);
  const job=data?.own,sequence=useRef(0),locked=useRef(false);
  async function refresh(){
    const seq=++sequence.current;
    const result=await api({action:"list",position:near});
    if(seq===sequence.current)setData(result);
  }
  useEffect(()=>{
    const poll=()=>{if(!document.hidden)refresh().catch(e=>setError(e.message));};
    poll();const timer=setInterval(poll,5000);document.addEventListener("visibilitychange",poll);
    return ()=>{sequence.current++;clearInterval(timer);document.removeEventListener("visibilitychange",poll);};
  },[near,user.id]);
  useEffect(()=>{
    if(!webJob || job?.id!==webJob || !["matched","driving"].includes(job.status)){setWebJob(0);return;}
    let last=0;
    const watch=navigator.geolocation.watchPosition(p=>{
      if(Date.now()-last<5000)return;last=Date.now();
      api({action:"fix",id:webJob,lat:p.coords.latitude,lng:p.coords.longitude,time:Math.round(p.timestamp)}).catch(e=>setError(e.message));
    },()=>setError("ยังอ่าน GPS ไม่ได้ ตรวจสิทธิ์ตำแหน่ง"),{enableHighAccuracy:true});
    return ()=>navigator.geolocation.clearWatch(watch);
  },[webJob,job?.id,job?.status]);
  async function run(fn){if(locked.current)return;locked.current=true;setBusy(true);setError("");try{await fn();await refresh();}catch(e){setError(e.message);}finally{locked.current=false;setBusy(false);}}
  const send=(action,extra={})=>api({action,id:job?.id,...extra});
  const dest=job?{lat:job.lat,lng:job.lng}:point;
  const driver=job?.seen?{lat:job.driverLat,lng:job.driverLng}:null;
  const tracking=job && (native?.trackingJob?.()===job.id || webJob===job.id);
  const btn=(label,fn,secondary=false)=><button type="button" disabled={busy} className={secondary?"secondary":"primary"} onClick={()=>run(fn)}>{label}</button>;
  return <section className="panel pickup">
    {error && <p role="alert" className="error">{error}</p>}
    {!data?<p>กำลังโหลดงานรับวัสดุ…</p>:job?<>
      <MapView pin={dest} driver={driver}/>
      <h2>{labels[job.status]}</h2><p>งาน #{job.id} · {job.material} · {job.grams/1000} กก. {job.shop && " · "+job.shop}</p>
      {job.seen && <small>ตำแหน่งรถล่าสุด {new Date(job.seen).toLocaleTimeString("th-TH")}</small>}
      {job.status==="open" && <p>รอร้านที่เปิดดูงานใกล้เคียง คุณยกเลิกและเลือกจองรอบแทนได้</p>}
      {buyer && ["matched","driving"].includes(job.status) && <>
        {tracking?btn("หยุดแชร์ตำแหน่ง",async()=>{native?.stopPickup?.();setWebJob(0);},true):btn("เริ่มแชร์ GPS กับผู้ขาย",async()=>{
          if(native && !native.startPickup)throw Error("กรุณาอัปเดต APK เป็นรุ่น 2.6.0");
          const pos=await gps();await send("fix",{...pos,time:Math.round(pos.time)});
          if(native)native.startPickup(job.id);else setWebJob(job.id);
        })}
        <small>{native?"แชร์ระหว่างงาน แม้เปิดแอปนำทาง หยุดได้จากปุ่มหรือการแจ้งเตือน":"บนเว็บ ให้เปิดหน้านี้ค้างไว้ขณะแชร์"}</small>
        {btn("เปิด Google Maps นำทาง",async()=>{if(native?.navigatePickup)native.navigatePickup(job.lat,job.lng);else window.open("https://www.google.com/maps/dir/?api=1&destination="+job.lat+","+job.lng,"_blank","noopener");},true)}
        {btn("ถึงจุดรับแล้ว",async()=>{await send("arrive");native?.stopPickup?.();setWebJob(0);})}
      </>}
      {buyer && ["arrived","weighed"].includes(job.status) && <form className="form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run(()=>send("weigh",{measured:Math.round(Number(f.get("kg"))*1000),amount:Math.round(Number(f.get("baht"))*100)}));}}>
        <label>น้ำหนักจริง (กก.)<input required name="kg" type="number" min=".001" step=".001"/></label>
        <label>ยอดที่จ่าย (บาท)<input required name="baht" type="number" min="0" step=".01"/></label>
        <button disabled={busy} className="primary">ส่งยอดให้ผู้ขาย</button></form>}
      {job.status==="weighed" && <><strong>{job.measured/1000} กก. · ฿{(job.amount/100).toFixed(2)}</strong>{!buyer && btn("ยืนยันได้รับเงินและปิดงาน",()=>send("finish",{expectedAmount:job.amount,expectedWeight:job.measured}))}</>}
      {["open","matched","driving"].includes(job.status) && btn(buyer?"คืนงานให้ร้านอื่น":"ยกเลิกคำขอ",async()=>{if(window.confirm("ยืนยันยกเลิกการรับงานนี้?")){await send("cancel");if(buyer)native?.stopPickup?.();setWebJob(0);}},true)}
    </>:buyer?<>
      <h2>งานรับวัสดุใกล้ฉัน</h2><p>ค้นหางานในชุมชน ภายใน 20 กม. ที่รถบรรทุกไหว</p>
      {btn("ค้นหาด้วยตำแหน่งปัจจุบัน",async()=>setNear(await gps()))}
      {near && !data.offers.length && <p>ยังไม่มีงานใกล้คุณ ระบบตรวจงานใหม่ระหว่างเปิดหน้านี้</p>}
      {data.offers.map(o=><div className="datarow" key={o.id}><span>{o.material} · {o.grams/1000} กก. · {o.km} กม.</span>{btn("รับงาน",()=>send("accept",{id:o.id,position:near}))}</div>)}
    </>:<>
      <MapView pin={point} pick={setPoint}/>
      <h2>เลือกจุดรับ</h2><p>แตะแผนที่เพื่อปักหมุด หรือใช้ตำแหน่งของมือถือ</p>
      {btn("ใช้ตำแหน่งของฉัน",async()=>setPoint(await gps()),true)}
      {point && <small>จุดรับ {point.lat.toFixed(5)}, {point.lng.toFixed(5)}</small>}
      <form className="form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run(()=>send("create",{lat:point.lat,lng:point.lng,material:f.get("material"),grams:Math.round(Number(f.get("kg"))*1000)}));}}>
        <label>วัสดุที่จะขาย<input required maxLength={100} name="material" placeholder="เช่น กระดาษลัง"/></label>
        <label>น้ำหนักโดยประมาณ (กก.)<input required name="kg" type="number" min=".001" step=".001" max="100000"/></label>
        <button disabled={!point||busy} className="primary">ยืนยันจุดรับและเรียกรถ</button></form>
    </>}
    {data?.last && <small>งานก่อนหน้า #{data.last.id} · {data.last.material} · {labels[data.last.status]} {data.last.amount!=null && " · ฿"+(data.last.amount/100).toFixed(2)}</small>}
  </section>;
}
