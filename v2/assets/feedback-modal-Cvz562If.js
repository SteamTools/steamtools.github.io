;!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="590b1cd0-cdb4-419d-a42c-749d46086573",e._sentryDebugIdIdentifier="sentry-dbid-590b1cd0-cdb4-419d-a42c-749d46086573")}catch(e){}}();
import{B as lt,r as tr,A as je,ai as rr}from"./main-2LhnC9ov.js";import{g as He,a as Je,G as nr,i as or,d as ke,b as Ve,c as ar,e as ir,f as lr,u as cr}from"./diag-client-C_CCkJf3.js";function sr(e,t={},r=Je()){const{message:n,name:a,email:o,url:l,source:u,associatedEventId:f,tags:c}=e,s={contexts:{feedback:{contact_email:o,name:a,message:n,url:l,source:u,associated_event_id:f}},type:"feedback",level:"info",tags:c},d=r?.getClient()||He();return d&&d.emit("beforeSendFeedback",s,t),r.captureEvent(s,t)}const H=nr,E=H.document,he=H.navigator,ur="Report a Bug",_r="Cancel",dr="Send Bug Report",fr="Confirm",pr="Report a Bug",hr="your.email@example.org",gr="Email",mr="What's the bug? What did you expect?",br="Description",vr="Your Name",yr="Name",wr="Thank you for your report!",Er="(required)",xr="Add a screenshot",Cr="Remove screenshot",Sr="Highlight",kr="Hide",Rr="Remove",Rt="Unable to submit feedback with empty message",Tt="No client setup, cannot send feedback.",Ft="Unable to determine if Feedback was correctly sent.",Lt="Unable to send feedback. This could be because this domain is not in your list of allowed domains.",Mt="Unable to send feedback. This could be because of network issues, or because you are using an ad-blocker.",Tr="widget",Fr=5e3,Lr={ERROR_EMPTY_MESSAGE:Rt,ERROR_NO_CLIENT:Tt,ERROR_TIMEOUT:Ft,ERROR_FORBIDDEN:Lt,ERROR_GENERIC:Mt};function Mr(e,t){return t?.[e]??Lr[e]}function pe(e,t){return new Error(Mr(e,t))}const Ar=(e,t={includeReplay:!0})=>{const r=t.errorMessages;if(!e.message)throw pe("ERROR_EMPTY_MESSAGE",r);const n=He();if(!n)throw pe("ERROR_NO_CLIENT",r);e.tags&&Object.keys(e.tags).length&&Je().setTags(e.tags);const a=sr({source:"api",url:Dr(),...e},t);return new Promise((o,l)=>{const u=setTimeout(()=>{f(),l(pe("ERROR_TIMEOUT",r))},3e4),f=n.on("afterSendEvent",(c,s)=>{if(c.event_id===a)return clearTimeout(u),f(),s?.statusCode&&s.statusCode>=200&&s.statusCode<300?o(a):s?.statusCode===403?l(pe("ERROR_FORBIDDEN",r)):l(pe("ERROR_GENERIC",r))})})};function Dr(){try{return H.document.location.href}catch{return""}}const Re=typeof __SENTRY_DEBUG__>"u"||__SENTRY_DEBUG__;function Ir(){return!(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(he.userAgent)||/Macintosh/i.test(he.userAgent)&&he.maxTouchPoints&&he.maxTouchPoints>1||!isSecureContext)}function xe(e,t){return{...e,...t,tags:{...e.tags,...t.tags},onFormOpen:()=>{t.onFormOpen?.(),e.onFormOpen?.()},onFormClose:()=>{t.onFormClose?.(),e.onFormClose?.()},onSubmitSuccess:(r,n)=>{t.onSubmitSuccess?.(r,n),e.onSubmitSuccess?.(r,n)},onSubmitError:r=>{t.onSubmitError?.(r),e.onSubmitError?.(r)},onFormSubmitted:()=>{t.onFormSubmitted?.(),e.onFormSubmitted?.()},themeDark:{...e.themeDark,...t.themeDark},themeLight:{...e.themeLight,...t.themeLight}}}function $r(e){const t=E.createElement("style");return t.textContent=`
.widget__actor {
  position: fixed;
  z-index: var(--z-index);
  margin: var(--page-margin);
  inset: var(--actor-inset);

  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;

  font-family: inherit;
  font-size: var(--font-size);
  font-weight: 600;
  line-height: 1.14em;
  text-decoration: none;

  background: var(--actor-background, var(--background));
  border-radius: var(--actor-border-radius, 1.7em/50%);
  border: var(--actor-border, var(--border));
  box-shadow: var(--actor-box-shadow, var(--box-shadow));
  color: var(--actor-color, var(--foreground));
  fill: var(--actor-color, var(--foreground));
  cursor: pointer;
  opacity: 1;
  transition: transform 0.2s ease-in-out;
  transform: translate(0, 0) scale(1);
}
.widget__actor[aria-hidden="true"] {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transform: translate(0, 16px) scale(0.98);
}

.widget__actor:hover {
  background: var(--actor-hover-background, var(--background));
  filter: var(--interactive-filter);
}

.widget__actor svg {
  width: 1.14em;
  height: 1.14em;
}

@media (max-width: 600px) {
  .widget__actor span {
    display: none;
  }
}
`,e&&t.setAttribute("nonce",e),t}function G(e,t){return Object.entries(t).forEach(([r,n])=>{e.setAttributeNS(null,r,n)}),e}const ue=20,Hr="http://www.w3.org/2000/svg";function Or(){const e=u=>H.document.createElementNS(Hr,u),t=G(e("svg"),{width:`${ue}`,height:`${ue}`,viewBox:`0 0 ${ue} ${ue}`,fill:"var(--actor-color, var(--foreground))"}),r=G(e("g"),{clipPath:"url(#clip0_57_80)"}),n=G(e("path"),{"fill-rule":"evenodd","clip-rule":"evenodd",d:"M15.6622 15H12.3997C12.2129 14.9959 12.031 14.9396 11.8747 14.8375L8.04965 12.2H7.49956V19.1C7.4875 19.3348 7.3888 19.5568 7.22256 19.723C7.05632 19.8892 6.83435 19.9879 6.59956 20H2.04956C1.80193 19.9968 1.56535 19.8969 1.39023 19.7218C1.21511 19.5467 1.1153 19.3101 1.11206 19.0625V12.2H0.949652C0.824431 12.2017 0.700142 12.1783 0.584123 12.1311C0.468104 12.084 0.362708 12.014 0.274155 11.9255C0.185602 11.8369 0.115689 11.7315 0.0685419 11.6155C0.0213952 11.4995 -0.00202913 11.3752 -0.00034808 11.25V3.75C-0.00900498 3.62067 0.0092504 3.49095 0.0532651 3.36904C0.0972798 3.24712 0.166097 3.13566 0.255372 3.04168C0.344646 2.94771 0.452437 2.87327 0.571937 2.82307C0.691437 2.77286 0.82005 2.74798 0.949652 2.75H8.04965L11.8747 0.1625C12.031 0.0603649 12.2129 0.00407221 12.3997 0H15.6622C15.9098 0.00323746 16.1464 0.103049 16.3215 0.278167C16.4966 0.453286 16.5964 0.689866 16.5997 0.9375V3.25269C17.3969 3.42959 18.1345 3.83026 18.7211 4.41679C19.5322 5.22788 19.9878 6.32796 19.9878 7.47502C19.9878 8.62209 19.5322 9.72217 18.7211 10.5333C18.1345 11.1198 17.3969 11.5205 16.5997 11.6974V14.0125C16.6047 14.1393 16.5842 14.2659 16.5395 14.3847C16.4948 14.5035 16.4268 14.6121 16.3394 14.7042C16.252 14.7962 16.147 14.8698 16.0307 14.9206C15.9144 14.9714 15.7891 14.9984 15.6622 15ZM1.89695 10.325H1.88715V4.625H8.33715C8.52423 4.62301 8.70666 4.56654 8.86215 4.4625L12.6872 1.875H14.7247V13.125H12.6872L8.86215 10.4875C8.70666 10.3835 8.52423 10.327 8.33715 10.325H2.20217C2.15205 10.3167 2.10102 10.3125 2.04956 10.3125C1.9981 10.3125 1.94708 10.3167 1.89695 10.325ZM2.98706 12.2V18.1625H5.66206V12.2H2.98706ZM16.5997 9.93612V5.01393C16.6536 5.02355 16.7072 5.03495 16.7605 5.04814C17.1202 5.13709 17.4556 5.30487 17.7425 5.53934C18.0293 5.77381 18.2605 6.06912 18.4192 6.40389C18.578 6.73866 18.6603 7.10452 18.6603 7.47502C18.6603 7.84552 18.578 8.21139 18.4192 8.54616C18.2605 8.88093 18.0293 9.17624 17.7425 9.41071C17.4556 9.64518 17.1202 9.81296 16.7605 9.90191C16.7072 9.91509 16.6536 9.9265 16.5997 9.93612Z"});t.appendChild(r).appendChild(n);const a=e("defs"),o=G(e("clipPath"),{id:"clip0_57_80"}),l=G(e("rect"),{width:`${ue}`,height:`${ue}`,fill:"white"});return o.appendChild(l),a.appendChild(o),t.appendChild(a).appendChild(o).appendChild(l),t}function Nr({triggerLabel:e,triggerAriaLabel:t,shadow:r,styleNonce:n}){const a=E.createElement("button");if(a.type="button",a.className="widget__actor",a.ariaHidden="false",a.ariaLabel=t||e||"Report a Bug",a.appendChild(Or()),e){const l=E.createElement("span");l.appendChild(E.createTextNode(e)),a.appendChild(l)}const o=$r(n);return{el:a,appendToDom(){r.appendChild(o),r.appendChild(a)},removeFromDom(){a.remove(),o.remove()},show(){a.ariaHidden="false"},hide(){a.ariaHidden="true"}}}const At="rgba(88, 74, 192, 1)",Pr={foreground:"#2b2233",background:"#ffffff",accentForeground:"white",accentBackground:At,successColor:"#268d75",errorColor:"#df3338",border:"1.5px solid rgba(41, 35, 47, 0.13)",inputBorder:"1.5px solid rgba(41, 35, 47, 0.6)",boxShadow:"0px 4px 24px 0px rgba(43, 34, 51, 0.12)",outline:"1px auto var(--accent-background)",interactiveFilter:"brightness(95%)"},ct={foreground:"#ebe6ef",background:"#29232f",accentForeground:"white",accentBackground:At,successColor:"#2da98c",errorColor:"#f55459",border:"1.5px solid rgba(235, 230, 239, 0.15)",inputBorder:"1.5px solid rgba(235, 230, 239, 0.6)",boxShadow:"0px 4px 24px 0px rgba(43, 34, 51, 0.12)",outline:"1px auto var(--accent-background)",interactiveFilter:"brightness(150%)"};function st(e){return`
  --foreground: ${e.foreground};
  --background: ${e.background};
  --accent-foreground: ${e.accentForeground};
  --accent-background: ${e.accentBackground};
  --success-color: ${e.successColor};
  --error-color: ${e.errorColor};
  --border: ${e.border};
  --input-border: ${e.inputBorder};
  --box-shadow: ${e.boxShadow};
  --outline: ${e.outline};
  --interactive-filter: ${e.interactiveFilter};
  `}function ut({colorScheme:e,themeDark:t,themeLight:r,styleNonce:n}){const a=E.createElement("style");return a.textContent=`
:host {
  --font-family: system-ui, 'Helvetica Neue', Arial, sans-serif;
  --font-size: 14px;
  --z-index: 100000;

  --page-margin: 16px;
  --inset: auto 0 0 auto;
  --actor-inset: var(--inset);

  font-family: var(--font-family);
  font-size: var(--font-size);

  ${e!=="system"?`color-scheme: only ${e};`:""}

  ${st(e==="dark"?{...ct,...t}:{...Pr,...r})}
}

${e==="system"?`
@media (prefers-color-scheme: dark) {
  :host {
    color-scheme: only dark;

    ${st({...ct,...t})}
  }
}`:""}
`,n&&a.setAttribute("nonce",n),a}const Br=({lazyLoadIntegration:e,getModalIntegration:t,getScreenshotIntegration:r})=>(({id:a="sentry-feedback",autoInject:o=!0,showBranding:l=!0,isEmailRequired:u=!1,isNameRequired:f=!1,showEmail:c=!0,showName:s=!0,enableScreenshot:d=!0,useSentryUser:i={email:"email",name:"username"},tags:_,styleNonce:h,scriptNonce:y,colorScheme:v="system",themeLight:g={},themeDark:p={},addScreenshotButtonLabel:T=xr,cancelButtonLabel:k=_r,confirmButtonLabel:O=fr,emailLabel:D=gr,emailPlaceholder:q=hr,formTitle:N=pr,isRequiredLabel:W=Er,messageLabel:F=br,messagePlaceholder:I=mr,nameLabel:b=yr,namePlaceholder:w=vr,removeScreenshotButtonLabel:A=Cr,submitButtonLabel:$=dr,successMessageText:ee=wr,triggerLabel:le=ur,triggerAriaLabel:P="",highlightToolText:B=Sr,hideToolText:M=kr,removeHighlightText:z=Rr,errorEmptyMessageText:ve=Rt,errorNoClientText:Y=Tt,errorTimeoutText:ye=Ft,errorForbiddenText:we=Lt,errorGenericText:Xt=Mt,onFormOpen:Zt,onFormClose:Yt,onSubmitSuccess:Kt,onSubmitError:Jt,onFormSubmitted:Qt}={})=>{const te={id:a,autoInject:o,showBranding:l,isEmailRequired:u,isNameRequired:f,showEmail:c,showName:s,enableScreenshot:d,useSentryUser:i,tags:_,styleNonce:h,scriptNonce:y,colorScheme:v,themeDark:p,themeLight:g,triggerLabel:le,triggerAriaLabel:P,cancelButtonLabel:k,submitButtonLabel:$,confirmButtonLabel:O,formTitle:N,emailLabel:D,emailPlaceholder:q,messageLabel:F,messagePlaceholder:I,nameLabel:b,namePlaceholder:w,successMessageText:ee,isRequiredLabel:W,addScreenshotButtonLabel:T,removeScreenshotButtonLabel:A,highlightToolText:B,hideToolText:M,removeHighlightText:z,errorEmptyMessageText:ve,errorNoClientText:Y,errorTimeoutText:ye,errorForbiddenText:we,errorGenericText:Xt,onFormClose:Yt,onFormOpen:Zt,onSubmitError:Jt,onSubmitSuccess:Kt,onFormSubmitted:Qt};let j=null,ce=null,fe=[];const ot=x=>{if(!j){const L=E.createElement("div");L.id=String(x.id),E.body.appendChild(L),j=L.attachShadow({mode:"open"}),ce=ut(x),j.appendChild(ce)}return j},at=async x=>{const L=x.enableScreenshot&&Ir();let K,U;try{K=(t?t():await e("feedbackModalIntegration",y))(),Ve(K)}catch{throw Re&&ke.error("[Feedback] Error when trying to load feedback integrations. Try using `feedbackSyncIntegration` in your `Sentry.init`."),new Error("[Feedback] Missing feedback modal integration!")}try{const se=L?r?r():await e("feedbackScreenshotIntegration",y):void 0;se&&(U=se(),Ve(U))}catch{Re&&ke.error("[Feedback] Missing feedback screenshot integration. Proceeding without screenshots.")}const V={ERROR_EMPTY_MESSAGE:x.errorEmptyMessageText,ERROR_NO_CLIENT:x.errorNoClientText,ERROR_TIMEOUT:x.errorTimeoutText,ERROR_FORBIDDEN:x.errorForbiddenText,ERROR_GENERIC:x.errorGenericText},Ee=(se,er)=>Ar(se,{includeReplay:!0,...er,errorMessages:V}),re=K.createDialog({options:{...x,onFormClose:()=>{re?.close(),x.onFormClose?.()},onFormSubmitted:()=>{re?.close(),x.onFormSubmitted?.()}},screenshotIntegration:U,sendFeedback:Ee,shadow:ot(x)});return re},it=(x,L={})=>{const K=xe(te,L),U=typeof x=="string"?E.querySelector(x):typeof x.addEventListener=="function"?x:null;if(!U)throw Re&&ke.error("[Feedback] Unable to attach to target element"),new Error("Unable to attach to target element");let V=null;const Ee=async()=>{V||(V=await at({...K,onFormSubmitted:()=>{V?.removeFromDom(),K.onFormSubmitted?.()}})),V.appendToDom(),V.open()};U.addEventListener("click",Ee);const re=()=>{fe=fe.filter(se=>se!==re),V?.removeFromDom(),V=null,U.removeEventListener("click",Ee)};return fe.push(re),re},Pe=(x={})=>{const L=xe(te,x),K=ot(L),U=Nr({triggerLabel:L.triggerLabel,triggerAriaLabel:L.triggerAriaLabel,shadow:K,styleNonce:h});return it(U.el,{...L,onFormOpen(){U.hide()},onFormClose(){U.show()},onFormSubmitted(){U.show()}}),U};return{name:"Feedback",setupOnce(){!or()||!te.autoInject||(E.readyState==="loading"?E.addEventListener("DOMContentLoaded",()=>Pe().appendToDom()):Pe().appendToDom())},attachTo:it,createWidget(x={}){const L=Pe(xe(te,x));return L.appendToDom(),L},async createForm(x={}){return at(xe(te,x))},setTheme(x){if(te.colorScheme=x,j){const L=ut(te);ce?j.replaceChild(L,ce):j.prepend(L),ce=L}},remove(){j&&(j.parentElement?.remove(),j=null,ce=null),fe.forEach(x=>x()),fe=[]}}});function Xe(){return He()?.getIntegrationByName("Feedback")}var Oe,S,Dt,J,_t,It,$t,Be,Te,ge,Ht,Qe,Ze,Ye,Ae={},De=[],Ur=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,Ne=Array.isArray;function X(e,t){for(var r in t)e[r]=t[r];return e}function et(e){e&&e.parentNode&&e.parentNode.removeChild(e)}function m(e,t,r){var n,a,o,l={};for(o in t)o=="key"?n=t[o]:o=="ref"?a=t[o]:l[o]=t[o];if(arguments.length>2&&(l.children=arguments.length>3?Oe.call(arguments,2):r),typeof e=="function"&&e.defaultProps!=null)for(o in e.defaultProps)l[o]===void 0&&(l[o]=e.defaultProps[o]);return Fe(e,l,n,a,null)}function Fe(e,t,r,n,a){var o={type:e,props:t,key:r,ref:n,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:a??++Dt,__i:-1,__u:0};return a==null&&S.vnode!=null&&S.vnode(o),o}function me(e){return e.children}function Le(e,t){this.props=e,this.context=t}function ae(e,t){if(t==null)return e.__?ae(e.__,e.__i+1):null;for(var r;t<e.__k.length;t++)if((r=e.__k[t])!=null&&r.__e!=null)return r.__e;return typeof e.type=="function"?ae(e):null}function Gr(e){if(e.__P&&e.__d){var t=e.__v,r=t.__e,n=[],a=[],o=X({},t);o.__v=t.__v+1,S.vnode&&S.vnode(o),tt(e.__P,o,t,e.__n,e.__P.namespaceURI,32&t.__u?[r]:null,n,r??ae(t),!!(32&t.__u),a),o.__v=t.__v,o.__.__k[o.__i]=o,Ut(n,o,a),t.__e=t.__=null,o.__e!=r&&Ot(o)}}function Ot(e){if((e=e.__)!=null&&e.__c!=null)return e.__e=e.__c.base=null,e.__k.some(function(t){if(t!=null&&t.__e!=null)return e.__e=e.__c.base=t.__e}),Ot(e)}function dt(e){(!e.__d&&(e.__d=!0)&&J.push(e)&&!Ie.__r++||_t!=S.debounceRendering)&&((_t=S.debounceRendering)||It)(Ie)}function Ie(){try{for(var e,t=1;J.length;)J.length>t&&J.sort($t),e=J.shift(),t=J.length,Gr(e)}finally{J.length=Ie.__r=0}}function Nt(e,t,r,n,a,o,l,u,f,c,s){var d,i,_,h,y,v,g=n&&n.__k||De,p=t.length;for(f=qr(r,t,g,f,p),d=0;d<p;d++)(_=r.__k[d])!=null&&(i=_.__i!=-1&&g[_.__i]||Ae,_.__i=d,v=tt(e,_,i,a,o,l,u,f,c,s),h=_.__e,_.ref&&i.ref!=_.ref&&(i.ref&&rt(i.ref,null,_),s.push(_.ref,_.__c||h,_)),y==null&&h!=null&&(y=h),4&_.__u?(f=Pt(_,f,e),i.__e&&(i.__e=null)):typeof _.type=="function"&&v!==void 0?f=v:h&&(f=h.nextSibling),_.__u&=-7);return r.__e=y,f}function qr(e,t,r,n,a){var o,l,u,f,c,s=r.length,d=s,i=0;for(e.__k=new Array(a),o=0;o<a;o++)(l=t[o])!=null&&typeof l!="boolean"&&typeof l!="function"?(typeof l=="string"||typeof l=="number"||typeof l=="bigint"||l.constructor==String?l=e.__k[o]=Fe(null,l,null,null,null):Ne(l)?l=e.__k[o]=Fe(me,{children:l},null,null,null):l.constructor===void 0&&l.__b>0?l=e.__k[o]=Fe(l.type,l.props,l.key,l.ref?l.ref:null,l.__v):e.__k[o]=l,f=o+i,l.__=e,l.__b=e.__b+1,u=null,(c=l.__i=zr(l,r,f,d))!=-1&&(d--,(u=r[c])&&(u.__u|=2)),u==null||u.__v==null?(c==-1&&(a>s?i--:a<s&&i++),typeof l.type!="function"&&(l.__u|=4)):c!=f&&(c==f-1?i--:c==f+1?i++:(c>f?i--:i++,l.__u|=4))):e.__k[o]=null;if(d)for(o=0;o<s;o++)(u=r[o])!=null&&(2&u.__u)==0&&(u.__e==n&&(n=ae(u)),qt(u,u));return n}function Pt(e,t,r){var n,a;if(typeof e.type=="function"){for(n=e.__k,a=0;n&&a<n.length;a++)n[a]&&(n[a].__=e,t=Pt(n[a],t,r));return t}e.__e!=t&&(t&&e.type&&!t.parentNode&&(t=ae(e)),t=r.insertBefore(e.__e,t||null));do t=t&&t.nextSibling;while(t!=null&&t.nodeType==8);return t}function zr(e,t,r,n){var a,o,l,u=e.key,f=e.type,c=t[r],s=c!=null&&(2&c.__u)==0;if(c===null&&u==null||s&&u==c.key&&f==c.type)return r;if(n>(s?1:0)){for(a=r-1,o=r+1;a>=0||o<t.length;)if((c=t[l=a>=0?a--:o++])!=null&&(2&c.__u)==0&&u==c.key&&f==c.type)return l}return-1}function ft(e,t,r){t[0]=="-"?e.setProperty(t,r??""):e[t]=r==null?"":typeof r!="number"||Ur.test(t)?r:r+"px"}function Ce(e,t,r,n,a){var o,l;e:if(t=="style")if(typeof r=="string")e.style.cssText=r;else{if(typeof n=="string"&&(e.style.cssText=n=""),n)for(t in n)r&&t in r||ft(e.style,t,"");if(r)for(t in r)n&&r[t]==n[t]||ft(e.style,t,r[t])}else if(t[0]=="o"&&t[1]=="n")o=t!=(t=t.replace(Ht,"$1")),l=t.toLowerCase(),t=l in e||t=="onFocusOut"||t=="onFocusIn"?l.slice(2):t.slice(2),e.l||(e.l={}),e.l[t+o]=r,r?n?r[ge]=n[ge]:(r[ge]=Qe,e.addEventListener(t,o?Ye:Ze,o)):e.removeEventListener(t,o?Ye:Ze,o);else{if(a=="http://www.w3.org/2000/svg")t=t.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(t!="width"&&t!="height"&&t!="href"&&t!="list"&&t!="form"&&t!="tabIndex"&&t!="download"&&t!="rowSpan"&&t!="colSpan"&&t!="role"&&t!="popover"&&t in e)try{e[t]=r??"";break e}catch{}typeof r=="function"||(r==null||r===!1&&t[4]!="-"?e.removeAttribute(t):e.setAttribute(t,t=="popover"&&r==1?"":r))}}function pt(e){return function(t){if(this.l){var r=this.l[t.type+e];if(t[Te]==null)t[Te]=Qe++;else if(t[Te]<r[ge])return;return r(S.event?S.event(t):t)}}}function tt(e,t,r,n,a,o,l,u,f,c){var s,d,i,_,h,y,v,g,p,T,k,O,D,q,N,W,F=t.type;if(t.constructor!==void 0)return null;128&r.__u&&(f=!!(32&r.__u),o=[u=t.__e=r.__e]),(s=S.__b)&&s(t);e:if(typeof F=="function"){d=l.length;try{if(p=t.props,T=F.prototype&&F.prototype.render,k=(s=F.contextType)&&n[s.__c],O=s?k?k.props.value:s.__:n,r.__c?g=(i=t.__c=r.__c).__=i.__E:(T?t.__c=i=new F(p,O):(t.__c=i=new Le(p,O),i.constructor=F,i.render=jr),k&&k.sub(i),i.state||(i.state={}),i.__n=n,_=i.__d=!0,i.__h=[],i._sb=[]),T&&i.__s==null&&(i.__s=i.state),T&&F.getDerivedStateFromProps!=null&&(i.__s==i.state&&(i.__s=X({},i.__s)),X(i.__s,F.getDerivedStateFromProps(p,i.__s))),h=i.props,y=i.state,i.__v=t,_)T&&F.getDerivedStateFromProps==null&&i.componentWillMount!=null&&i.componentWillMount(),T&&i.componentDidMount!=null&&i.__h.push(i.componentDidMount);else{if(T&&F.getDerivedStateFromProps==null&&p!==h&&i.componentWillReceiveProps!=null&&i.componentWillReceiveProps(p,O),t.__v==r.__v||!i.__e&&i.shouldComponentUpdate!=null&&i.shouldComponentUpdate(p,i.__s,O)===!1){t.__v!=r.__v&&(i.props=p,i.state=i.__s,i.__d=!1),t.__e=r.__e,t.__k=r.__k,t.__k.some(function(I){I&&(I.__=t)}),De.push.apply(i.__h,i._sb),i._sb=[],i.__h.length&&l.push(i),u=ae(r);break e}i.componentWillUpdate!=null&&i.componentWillUpdate(p,i.__s,O),T&&i.componentDidUpdate!=null&&i.__h.push(function(){i.componentDidUpdate(h,y,v)})}if(i.context=O,i.props=p,i.__P=e,i.__e=!1,D=S.__r,q=0,T)i.state=i.__s,i.__d=!1,D&&D(t),s=i.render(i.props,i.state,i.context),De.push.apply(i.__h,i._sb),i._sb=[];else do i.__d=!1,D&&D(t),s=i.render(i.props,i.state,i.context),i.state=i.__s;while(i.__d&&++q<25);i.state=i.__s,i.getChildContext!=null&&(n=X(X({},n),i.getChildContext())),T&&!_&&i.getSnapshotBeforeUpdate!=null&&(v=i.getSnapshotBeforeUpdate(h,y)),N=s!=null&&s.type===me&&s.key==null?Gt(s.props.children):s,u=Nt(e,Ne(N)?N:[N],t,r,n,a,o,l,u,f,c),i.base=t.__e,t.__u&=-161,i.__h.length&&l.push(i),g&&(i.__E=i.__=null)}catch(I){if(l.length=d,t.__v=null,f||o!=null){if(I.then){for(t.__u|=f?160:128;u&&u.nodeType==8&&u.nextSibling;)u=u.nextSibling;o!=null&&(o[o.indexOf(u)]=null),t.__e=u}else if(o!=null)for(W=o.length;W--;)et(o[W])}else t.__e=r.__e;t.__k??(t.__k=r.__k||[]),I.then||Bt(t),S.__e(I,t,r)}}else o==null&&t.__v==r.__v?(t.__k=r.__k,t.__e=r.__e):u=t.__e=Wr(r.__e,t,r,n,a,o,l,f,c);return(s=S.diffed)&&s(t),128&t.__u?void 0:u}function Bt(e){e&&(e.__c&&(e.__c.__e=!0),e.__k&&e.__k.some(Bt))}function Ut(e,t,r){for(var n=0;n<r.length;n++)rt(r[n],r[++n],r[++n]);S.__c&&S.__c(t,e),e.some(function(a){try{e=a.__h,a.__h=[],e.some(function(o){o.call(a)})}catch(o){S.__e(o,a.__v)}})}function Gt(e){return typeof e!="object"||e==null||e.__b>0?e:Ne(e)?e.map(Gt):e.constructor!==void 0?null:X({},e)}function Wr(e,t,r,n,a,o,l,u,f){var c,s,d,i,_,h,y,v=r.props||Ae,g=t.props,p=t.type;if(p=="svg"?a="http://www.w3.org/2000/svg":p=="math"?a="http://www.w3.org/1998/Math/MathML":a||(a="http://www.w3.org/1999/xhtml"),o!=null){for(c=0;c<o.length;c++)if((_=o[c])&&"setAttribute"in _==!!p&&(p?_.localName==p:_.nodeType==3)){e=_,o[c]=null;break}}if(e==null){if(p==null)return document.createTextNode(g);e=document.createElementNS(a,p,g.is&&g),u&&(S.__m&&S.__m(t,o),u=!1),o=null}if(p==null)v===g||u&&e.data==g||(e.data=g);else{if(o=p=="textarea"&&g.defaultValue!=null?null:o&&Oe.call(e.childNodes),!u&&o!=null)for(v={},c=0;c<e.attributes.length;c++)v[(_=e.attributes[c]).name]=_.value;for(c in v)_=v[c],c=="dangerouslySetInnerHTML"?d=_:c=="children"||c in g||c=="value"&&"defaultValue"in g||c=="checked"&&"defaultChecked"in g||Ce(e,c,null,_,a);for(c in g)_=g[c],c=="children"?i=_:c=="dangerouslySetInnerHTML"?s=_:c=="value"?h=_:c=="checked"?y=_:u&&typeof _!="function"||v[c]===_||Ce(e,c,_,v[c],a);if(s)u||d&&(s.__html==d.__html||s.__html==e.innerHTML)||(e.innerHTML=s.__html),t.__k=[];else if(d&&(e.innerHTML=""),Nt(t.type=="template"?e.content:e,Ne(i)?i:[i],t,r,n,p=="foreignObject"?"http://www.w3.org/1999/xhtml":a,o,l,o?o[0]:r.__k&&ae(r,0),u,f),o!=null)for(c=o.length;c--;)et(o[c]);u&&p!="textarea"||(c="value",p=="progress"&&h==null?e.removeAttribute("value"):h!=null&&(h!==e[c]||p=="progress"&&!h||p=="option"&&h!=v[c])&&Ce(e,c,h,v[c],a),c="checked",y!=null&&y!=e[c]&&Ce(e,c,y,v[c],a))}return e}function rt(e,t,r){try{if(typeof e=="function"){var n=typeof e.__u=="function";n&&e.__u(),n&&t==null||(e.__u=e(t))}else e.current=t}catch(a){S.__e(a,r)}}function qt(e,t,r){var n,a;if(S.unmount&&S.unmount(e),(n=e.ref)&&(n.current&&n.current!=e.__e||rt(n,null,t)),(n=e.__c)!=null){if(n.componentWillUnmount)try{n.componentWillUnmount()}catch(o){S.__e(o,t)}n.base=n.__P=n.__n=null}if(n=e.__k)for(a=0;a<n.length;a++)n[a]&&qt(n[a],t,r||typeof e.type!="function");r||et(e.__e),e.__c=e.__=e.__e=void 0}function jr(e,t,r){return this.constructor(e,r)}function ht(e,t,r){var n,a,o,l;t==document&&(t=document.documentElement),S.__&&S.__(e,t),a=(n=!1)?null:t.__k,o=[],l=[],tt(t,e=t.__k=m(me,null,[e]),a||Ae,Ae,t.namespaceURI,a?null:t.firstChild?Oe.call(t.childNodes):null,o,a?a.__e:t.firstChild,n,l),Ut(o,e,l),e.props.children=null}Oe=De.slice,S={__e:function(e,t,r,n){for(var a,o,l;t=t.__;)if((a=t.__c)&&!a.__)try{if((o=a.constructor)&&o.getDerivedStateFromError!=null&&(a.setState(o.getDerivedStateFromError(e)),l=a.__d),a.componentDidCatch!=null&&(a.componentDidCatch(e,n||{}),l=a.__d),l)return a.__E=a}catch(u){e=u}throw e}},Dt=0,Le.prototype.setState=function(e,t){var r=this.__s!=null&&this.__s!=this.state?this.__s:this.__s=X({},this.state);typeof e=="function"&&(e=e(X({},r),this.props)),e&&X(r,e),e!=null&&this.__v&&(t&&this._sb.push(t),dt(this))},Le.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),dt(this))},Le.prototype.render=me,J=[],It=typeof Promise=="function"?Promise.prototype.then.bind(Promise.resolve()):setTimeout,$t=function(e,t){return e.__v.__b-t.__v.__b},Ie.__r=0,Be=Math.random().toString(8),Te="__d"+Be,ge="__a"+Be,Ht=/(PointerCapture)$|Capture$/i,Qe=0,Ze=pt(!1),Ye=pt(!0);var gt=Object.defineProperty,Vr=(e,t)=>{let r=Object.setPrototypeOf({},null);for(var n in e)gt(r,n,{get:e[n],enumerable:!0});return gt(r,Symbol.toStringTag,{value:"Module"}),t&2?r:Object.preventExtensions(r)},Xr=Vr({useCallback:()=>_e,useContext:()=>Kr,useDebugValue:()=>Jr,useEffect:()=>Zr,useErrorBoundary:()=>Qr,useId:()=>en,useImperativeHandle:()=>Yr,useLayoutEffect:()=>$e,useMemo:()=>be,useReducer:()=>Wt,useRef:()=>jt,useState:()=>ne}),Z,C,Ue,mt,de=0,zt=[],R=S,bt=R.__b,vt=R.__r,yt=R.diffed,wt=R.__c,Et=R.unmount,xt=R.__;function ie(e,t){R.__h&&R.__h(C,e,de||t),de=0;var r=C.__H||(C.__H={__:[],__h:[]});return e>=r.__.length&&r.__.push({}),r.__[e]}function ne(e){return de=1,Wt(Vt,e)}function Wt(e,t,r){var n=ie(Z++,2);if(n.t=e,!n.__c&&(n.__=[r?r(t):Vt(void 0,t),function(u){var f=n.__N?n.__N[0]:n.__[0],c=n.t(f,u);f!==c&&(n.__N=[c,n.__[1]],n.__c.setState({}))}],n.__c=C,!C.__f)){var a=function(u,f,c){if(!n.__c.__H)return!0;var s=!1,d=n.__c.props!==u;if(n.__c.__H.__.some(function(_){if(_.__N){s=!0;var h=_.__[0];_.__=_.__N,_.__N=void 0,h!==_.__[0]&&(d=!0)}}),o){var i=o.call(this,u,f,c);return s?i||d:i}return!s||d};C.__f=!0;var o=C.shouldComponentUpdate,l=C.componentWillUpdate;C.componentWillUpdate=function(u,f,c){if(this.__e){var s=o;o=void 0,a(u,f,c),o=s}l&&l.call(this,u,f,c)},C.shouldComponentUpdate=a}return n.__N||n.__}function Zr(e,t){var r=ie(Z++,3);!R.__s&&nt(r.__H,t)&&(r.__=e,r.u=t,C.__H.__h.push(r))}function $e(e,t){var r=ie(Z++,4);!R.__s&&nt(r.__H,t)&&(r.__=e,r.u=t,C.__h.push(r))}function jt(e){return de=5,be(function(){return{current:e}},[])}function Yr(e,t,r){de=6,$e(function(){if(typeof e=="function"){var n=e(t());return function(){e(null),n&&typeof n=="function"&&n()}}if(e)return e.current=t(),function(){return e.current=null}},r==null?r:r.concat(e))}function be(e,t){var r=ie(Z++,7);return nt(r.__H,t)&&(r.__=e(),r.__H=t,r.__h=e),r.__}function _e(e,t){return de=8,be(function(){return e},t)}function Kr(e){var t=C.context[e.__c],r=ie(Z++,9);return r.c=e,t?(r.__??(r.__=!0,t.sub(C)),t.props.value):e.__}function Jr(e,t){R.useDebugValue&&R.useDebugValue(t?t(e):e)}function Qr(e){var t=ie(Z++,10),r=ne();return t.__=e,C.componentDidCatch||(C.componentDidCatch=function(n,a){t.__&&t.__(n,a),r[1](n)}),[r[0],function(){r[1](void 0)}]}function en(){var e=ie(Z++,11);if(!e.__){for(var t=C.__v;t!==null&&!t.__m&&t.__!==null;)t=t.__;var r=t.__m||(t.__m=[0,0]);e.__="P"+r[0]+"-"+r[1]++}return e.__}function tn(){for(var e;e=zt.shift();){var t=e.__H;if(e.__P&&t)try{t.__h.some(Me),t.__h.some(Ke),t.__h=[]}catch(r){t.__h=[],R.__e(r,e.__v)}}}R.__b=function(e){C=null,bt&&bt(e)},R.__=function(e,t){e&&t.__k&&t.__k.__m&&(e.__m=t.__k.__m),xt&&xt(e,t)},R.__r=function(e){vt&&vt(e),Z=0;var t=(C=e.__c).__H;t&&(Ue===C?(t.__h=[],C.__h=[],t.__.some(function(r){r.__N&&(r.__=r.__N),r.u=r.__N=void 0})):(t.__h.some(Me),t.__h.some(Ke),t.__h=[],Z=0)),Ue=C},R.diffed=function(e){yt&&yt(e);var t=e.__c;t&&t.__H&&(t.__H.__h.length&&(zt.push(t)!==1&&mt===R.requestAnimationFrame||((mt=R.requestAnimationFrame)||rn)(tn)),t.__H.__.some(function(r){r.u&&(r.__H=r.u,r.u=void 0)})),Ue=C=null},R.__c=function(e,t){t.some(function(r){try{r.__h.some(Me),r.__h=r.__h.filter(function(n){return!n.__||Ke(n)})}catch(n){t.some(function(a){a.__h&&(a.__h=[])}),t=[],R.__e(n,r.__v)}}),wt&&wt(e,t)},R.unmount=function(e){Et&&Et(e);var t,r=e.__c;r&&r.__H&&(r.__H.__.some(function(n){try{Me(n)}catch(a){t=a}}),r.__H=void 0,t&&R.__e(t,r.__v))};var Ct=typeof requestAnimationFrame=="function";function rn(e){var t,r=function(){clearTimeout(n),Ct&&cancelAnimationFrame(t),setTimeout(e)},n=setTimeout(r,35);Ct&&(t=requestAnimationFrame(r))}function Me(e){var t=C,r=e.__c;typeof r=="function"&&(e.__c=void 0,r()),C=t}function Ke(e){var t=C;e.__c=e.__(),C=t}function nt(e,t){return!e||e.length!==t.length||t.some(function(r,n){return r!==e[n]})}function Vt(e,t){return typeof t=="function"?t(e):t}const nn="http://www.w3.org/2000/svg";function on(){const e=n=>E.createElementNS(nn,n),t=G(e("svg"),{width:"32",height:"30",viewBox:"0 0 72 66",fill:"inherit"}),r=G(e("path"),{transform:"translate(11, 11)",d:"M29,2.26a4.67,4.67,0,0,0-8,0L14.42,13.53A32.21,32.21,0,0,1,32.17,40.19H27.55A27.68,27.68,0,0,0,12.09,17.47L6,28a15.92,15.92,0,0,1,9.23,12.17H4.62A.76.76,0,0,1,4,39.06l2.94-5a10.74,10.74,0,0,0-3.36-1.9l-2.91,5a4.54,4.54,0,0,0,1.69,6.24A4.66,4.66,0,0,0,4.62,44H19.15a19.4,19.4,0,0,0-8-17.31l2.31-4A23.87,23.87,0,0,1,23.76,44H36.07a35.88,35.88,0,0,0-16.41-31.8l4.67-8a.77.77,0,0,1,1.05-.27c.53.29,20.29,34.77,20.66,35.17a.76.76,0,0,1-.68,1.13H40.6q.09,1.91,0,3.81h4.78A4.59,4.59,0,0,0,50,39.43a4.49,4.49,0,0,0-.62-2.28Z"});return t.appendChild(r),t}function an({options:e}){const t=be(()=>({__html:on().outerHTML}),[]);return m("h2",{class:"dialog__header"},m("span",{class:"dialog__title"},e.formTitle),e.showBranding?m("a",{class:"brand-link",target:"_blank",href:"https://sentry.io/welcome/",title:"Powered by Sentry",rel:"noopener noreferrer",dangerouslySetInnerHTML:t}):null)}function ln(e,t){const r=[];return t.isNameRequired&&!e.name&&r.push(t.nameLabel),t.isEmailRequired&&!e.email&&r.push(t.emailLabel),e.message||r.push(t.messageLabel),r}function Ge(e,t){const r=e.get(t);return typeof r=="string"?r.trim():""}function cn({options:e,defaultEmail:t,defaultName:r,onFormClose:n,onSubmit:a,onSubmitSuccess:o,onSubmitError:l,showEmail:u,showName:f,screenshotInput:c}){const{tags:s,addScreenshotButtonLabel:d,removeScreenshotButtonLabel:i,cancelButtonLabel:_,emailLabel:h,emailPlaceholder:y,isEmailRequired:v,isNameRequired:g,messageLabel:p,messagePlaceholder:T,nameLabel:k,namePlaceholder:O,submitButtonLabel:D,isRequiredLabel:q}=e,[N,W]=ne(!1),[F,I]=ne(null),[b,w]=ne(!1),A=c?.input,[$,ee]=ne(null),le=_e(M=>{ee(M),w(!1)},[]),P=_e(M=>{const z=ln(M,{emailLabel:h,isEmailRequired:v,isNameRequired:g,messageLabel:p,nameLabel:k});return z.length>0?I(`Please enter in the following required fields: ${z.join(", ")}`):I(null),z.length===0},[h,v,g,p,k]),B=_e(async M=>{W(!0);try{if(M.preventDefault(),!(M.target instanceof HTMLFormElement))return;const z=new FormData(M.target),ve=await(c&&b?c.value():void 0),Y={name:Ge(z,"name"),email:Ge(z,"email"),message:Ge(z,"message"),attachments:ve?[ve]:void 0};if(!P(Y))return;try{o(Y,await a({name:Y.name,email:Y.email,message:Y.message,source:Tr,tags:s},{attachments:Y.attachments}))}catch(ye){Re&&ke.error(ye);const we=ye;I(we.message),l(we)}}finally{W(!1)}},[c&&b,o,l]);return m("form",{class:"form",onSubmit:B},A&&b?m(A,{onError:le}):null,m("fieldset",{class:"form__right","data-sentry-feedback":!0,disabled:N},m("div",{class:"form__top"},F?m("div",{class:"form__error-container"},F):null,f?m("label",{for:"name",class:"form__label"},m(qe,{label:k,isRequiredLabel:q,isRequired:g}),m("input",{class:"form__input",defaultValue:r,id:"name",name:"name",placeholder:O,required:g,type:"text"})):m("input",{"aria-hidden":!0,value:r,name:"name",type:"hidden"}),u?m("label",{for:"email",class:"form__label"},m(qe,{label:h,isRequiredLabel:q,isRequired:v}),m("input",{class:"form__input",defaultValue:t,id:"email",name:"email",placeholder:y,required:v,type:"email"})):m("input",{"aria-hidden":!0,value:t,name:"email",type:"hidden"}),m("label",{for:"message",class:"form__label"},m(qe,{label:p,isRequiredLabel:q,isRequired:!0}),m("textarea",{autoFocus:!0,class:"form__input form__input--textarea",id:"message",name:"message",placeholder:T,required:!0,rows:5})),A?m("label",{for:"screenshot",class:"form__label"},m("button",{class:"btn btn--default",disabled:N,type:"button",onClick:()=>{ee(null),w(M=>!M)}},b?i:d),$?m("div",{class:"form__error-container"},$.message):null):null),m("div",{class:"btn-group"},m("button",{class:"btn btn--primary",disabled:N,type:"submit"},D),m("button",{class:"btn btn--default",disabled:N,type:"button",onClick:n},_))))}function qe({label:e,isRequired:t,isRequiredLabel:r}){return m("span",{class:"form__label__text"},e,t&&m("span",{class:"form__label__text--required"},r))}const Se=16,St=17,sn="http://www.w3.org/2000/svg";function un(){const e=f=>H.document.createElementNS(sn,f),t=G(e("svg"),{width:`${Se}`,height:`${St}`,viewBox:`0 0 ${Se} ${St}`,fill:"inherit"}),r=G(e("g"),{clipPath:"url(#clip0_57_156)"}),n=G(e("path"),{"fill-rule":"evenodd","clip-rule":"evenodd",d:"M3.55544 15.1518C4.87103 16.0308 6.41775 16.5 8 16.5C10.1217 16.5 12.1566 15.6571 13.6569 14.1569C15.1571 12.6566 16 10.6217 16 8.5C16 6.91775 15.5308 5.37103 14.6518 4.05544C13.7727 2.73985 12.5233 1.71447 11.0615 1.10897C9.59966 0.503466 7.99113 0.34504 6.43928 0.653721C4.88743 0.962403 3.46197 1.72433 2.34315 2.84315C1.22433 3.96197 0.462403 5.38743 0.153721 6.93928C-0.15496 8.49113 0.00346625 10.0997 0.608967 11.5615C1.21447 13.0233 2.23985 14.2727 3.55544 15.1518ZM4.40546 3.1204C5.46945 2.40946 6.72036 2.03 8 2.03C9.71595 2.03 11.3616 2.71166 12.575 3.92502C13.7883 5.13838 14.47 6.78405 14.47 8.5C14.47 9.77965 14.0905 11.0306 13.3796 12.0945C12.6687 13.1585 11.6582 13.9878 10.476 14.4775C9.29373 14.9672 7.99283 15.0953 6.73777 14.8457C5.48271 14.596 4.32987 13.9798 3.42502 13.075C2.52018 12.1701 1.90397 11.0173 1.65432 9.76224C1.40468 8.50718 1.5328 7.20628 2.0225 6.02404C2.5122 4.8418 3.34148 3.83133 4.40546 3.1204Z"}),a=G(e("path"),{d:"M6.68775 12.4297C6.78586 12.4745 6.89218 12.4984 7 12.5C7.11275 12.4955 7.22315 12.4664 7.32337 12.4145C7.4236 12.3627 7.51121 12.2894 7.58 12.2L12 5.63999C12.0848 5.47724 12.1071 5.28902 12.0625 5.11098C12.0178 4.93294 11.9095 4.77744 11.7579 4.67392C11.6064 4.57041 11.4221 4.52608 11.24 4.54931C11.0579 4.57254 10.8907 4.66173 10.77 4.79999L6.88 10.57L5.13 8.56999C5.06508 8.49566 4.98613 8.43488 4.89768 8.39111C4.80922 8.34735 4.713 8.32148 4.61453 8.31498C4.51605 8.30847 4.41727 8.32147 4.32382 8.35322C4.23038 8.38497 4.14413 8.43484 4.07 8.49999C3.92511 8.63217 3.83692 8.81523 3.82387 9.01092C3.81083 9.2066 3.87393 9.39976 4 9.54999L6.43 12.24C6.50187 12.3204 6.58964 12.385 6.68775 12.4297Z"});t.appendChild(r).append(a,n);const o=e("defs"),l=G(e("clipPath"),{id:"clip0_57_156"}),u=G(e("rect"),{width:`${Se}`,height:`${Se}`,fill:"white",transform:"translate(0 0.5)"});return l.appendChild(u),o.appendChild(l),t.appendChild(o).appendChild(l).appendChild(u),t}function _n({open:e,onFormSubmitted:t,...r}){const n=r.options,a=be(()=>({__html:un().outerHTML}),[]),[o,l]=ne(null),u=jt(null);$e(()=>{const s=u.current;if(e&&s&&!s.open){try{s.showModal()}catch{s.setAttribute("open","")}s.querySelector("[autofocus]")?.focus()}return()=>{typeof s?.close=="function"?s.close():s?.removeAttribute("open")}},[e,o]),$e(()=>()=>{o&&clearTimeout(o)},[o]);const f=_e(()=>{o&&(clearTimeout(o),l(null)),t()},[o]),c=_e((s,d)=>{r.onSubmitSuccess(s,d),l(setTimeout(()=>{t(),l(null)},Fr))},[t]);return m(me,null,o?m("div",{class:"success__position",onClick:f},m("div",{class:"success__content"},n.successMessageText,m("span",{class:"success__icon",dangerouslySetInnerHTML:a}))):m("dialog",{class:"dialog",ref:u,"aria-label":n.formTitle,onClick:n.onFormClose,onCancel:s=>{s.preventDefault(),n.onFormClose?.()},onKeyDown:s=>{s.key==="Escape"&&(s.preventDefault(),n.onFormClose?.())}},m("div",{class:"dialog__position"},m("div",{class:"dialog__content",onClick:s=>{s.stopPropagation()}},m(an,{options:n}),m(cn,{...r,onSubmitSuccess:c})))))}const dn=`
.dialog {
  position: fixed;
  z-index: var(--z-index);
  margin: 0;
  inset: 0;

  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  height: 100vh;
  width: 100vw;
  max-height: none;
  max-width: none;

  color: var(--dialog-color, var(--foreground));
  fill: var(--dialog-color, var(--foreground));
  line-height: 1.75em;

  background-color: rgba(0, 0, 0, 0.05);
  border: none;
  inset: 0;
  opacity: 1;
  transition: opacity 0.2s ease-in-out;
}

.dialog::backdrop {
  background: transparent;
}

.dialog__position {
  position: fixed;
  z-index: var(--z-index);
  inset: var(--dialog-inset);
  padding: var(--page-margin);
  display: flex;
  max-height: calc(100vh - (2 * var(--page-margin)));
}
@media (max-width: 600px) {
  .dialog__position {
    inset: var(--page-margin);
    padding: 0;
  }
}

.dialog__position:has(.editor) {
  inset: var(--page-margin);
  padding: 0;
}

.dialog:not([open]) {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}
.dialog:not([open]) .dialog__content {
  transform: translate(0, -16px) scale(0.98);
}

.dialog__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: var(--dialog-padding, 24px);
  max-width: 100%;
  width: 100%;
  max-height: 100%;
  overflow: auto;

  background: var(--dialog-background, var(--background));
  border-radius: var(--dialog-border-radius, 20px);
  border: var(--dialog-border, var(--border));
  box-shadow: var(--dialog-box-shadow, var(--box-shadow));
  transform: translate(0, 0) scale(1);
  transition: transform 0.2s ease-in-out;
}

`,fn=`
.dialog__header {
  display: flex;
  gap: 4px;
  justify-content: space-between;
  font-weight: var(--dialog-header-weight, 600);
  margin: 0;
}
.dialog__title {
  align-self: center;
  width: var(--form-width, 272px);
}

@media (max-width: 600px) {
  .dialog__title {
    width: auto;
  }
}

.dialog__position:has(.editor) .dialog__title {
  width: auto;
}


.brand-link {
  display: inline-flex;
}
.brand-link:focus-visible {
  outline: var(--outline);
}
`,pn=`
.form {
  display: flex;
  overflow: auto;
  flex-direction: row;
  gap: 16px;
  flex: 1 0;
}

.form fieldset {
  border: none;
  margin: 0;
  padding: 0;
}

.form__right {
  flex: 0 0 auto;
  display: flex;
  overflow: auto;
  flex-direction: column;
  justify-content: space-between;
  gap: 20px;
  width: var(--form-width, 100%);
}

.dialog__position:has(.editor) .form__right {
  width: var(--form-width, 272px);
}

.form__top {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form__error-container {
  color: var(--error-color);
  fill: var(--error-color);
  width: 0;
  min-width: 100%;
  overflow-wrap: break-word;
}

.form__label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0px;
}

.form__label__text {
  display: flex;
  gap: 4px;
  align-items: center;
}

.form__label__text--required {
  font-size: 0.85em;
}

.form__input {
  font-family: inherit;
  line-height: inherit;
  background: transparent;
  box-sizing: border-box;
  border: var(--input-border, var(--border));
  border-radius: var(--input-border-radius, 6px);
  color: var(--input-color, inherit);
  fill: var(--input-color, inherit);
  font-size: var(--input-font-size, inherit);
  font-weight: var(--input-font-weight, 500);
  padding: 6px 12px;
}

.form__input::placeholder {
  opacity: 0.65;
  color: var(--input-placeholder-color, inherit);
  filter: var(--interactive-filter);
}

.form__input:focus-visible {
  outline: var(--input-focus-outline, var(--outline));
}

.form__input--textarea {
  font-family: inherit;
  resize: vertical;
}

.error {
  color: var(--error-color);
  fill: var(--error-color);
}
`,hn=`
.btn-group {
  display: grid;
  gap: 8px;
}

.btn {
  line-height: inherit;
  border: var(--button-border, var(--border));
  border-radius: var(--button-border-radius, 6px);
  cursor: pointer;
  font-family: inherit;
  font-size: var(--button-font-size, inherit);
  font-weight: var(--button-font-weight, 600);
  padding: var(--button-padding, 6px 16px);
}
.btn[disabled] {
  opacity: 0.6;
  pointer-events: none;
}

.btn--primary {
  color: var(--button-primary-color, var(--accent-foreground));
  fill: var(--button-primary-color, var(--accent-foreground));
  background: var(--button-primary-background, var(--accent-background));
  border: var(--button-primary-border, var(--border));
  border-radius: var(--button-primary-border-radius, 6px);
  font-weight: var(--button-primary-font-weight, 500);
}
.btn--primary:hover {
  color: var(--button-primary-hover-color, var(--accent-foreground));
  fill: var(--button-primary-hover-color, var(--accent-foreground));
  background: var(--button-primary-hover-background, var(--accent-background));
  filter: var(--interactive-filter);
}
.btn--primary:focus-visible {
  background: var(--button-primary-hover-background, var(--accent-background));
  filter: var(--interactive-filter);
  outline: var(--button-primary-focus-outline, var(--outline));
}

.btn--default {
  color: var(--button-color, var(--foreground));
  fill: var(--button-color, var(--foreground));
  background: var(--button-background, var(--background));
  border: var(--button-border, var(--border));
  border-radius: var(--button-border-radius, 6px);
  font-weight: var(--button-font-weight, 500);
}
.btn--default:hover {
  color: var(--button-color, var(--foreground));
  fill: var(--button-color, var(--foreground));
  background: var(--button-hover-background, var(--background));
  filter: var(--interactive-filter);
}
.btn--default:focus-visible {
  background: var(--button-hover-background, var(--background));
  filter: var(--interactive-filter);
  outline: var(--button-focus-outline, var(--outline));
}
`,gn=`
.success__position {
  position: fixed;
  inset: var(--dialog-inset);
  padding: var(--page-margin);
  z-index: var(--z-index);
}
.success__content {
  background: var(--success-background, var(--background));
  border: var(--success-border, var(--border));
  border-radius: var(--success-border-radius, 1.7em/50%);
  box-shadow: var(--success-box-shadow, var(--box-shadow));
  font-weight: var(--success-font-weight, 600);
  color: var(--success-color);
  fill: var(--success-color);
  padding: 12px 24px;
  line-height: 1.75em;

  display: grid;
  align-items: center;
  grid-auto-flow: column;
  gap: 6px;
  cursor: default;
}

.success__icon {
  display: flex;
}
`;function mn(e){const t=E.createElement("style");return t.textContent=`
:host {
  --dialog-inset: var(--inset);
}

${dn}
${fn}
${pn}
${hn}
${gn}
`,e&&t.setAttribute("nonce",e),t}function bn(){const e=Je().getUser(),t=ar().getUser(),r=ir().getUser();return e&&Object.keys(e).length?e:t&&Object.keys(t).length?t:r}const vn=(()=>({name:"FeedbackModal",setupOnce(){},createDialog:({options:e,screenshotIntegration:t,sendFeedback:r,shadow:n})=>{const a=n,o=e.useSentryUser,l=bn(),u=E.createElement("div"),f=mn(e.styleNonce);let c="",s=!1,d=null;const i=()=>{const g=d;d=null,Promise.resolve().then(()=>{const p=E.activeElement;!s&&(!p||p===E.body||p===a.host)&&g instanceof HTMLElement&&g.focus()})},_=()=>{s&&(s=!1,E.body.style.overflow=c),v(!1)},h={get el(){return u},appendToDom(){!a.contains(f)&&!a.contains(u)&&(a.appendChild(f),a.appendChild(u))},removeFromDom(){h.close(),ht(null,u),u.remove(),f.remove()},open(){if(!s){for(d=E.activeElement;d?.shadowRoot?.activeElement;)d=d.shadowRoot.activeElement;c=E.body.style.overflow,s=!0,v(!0),e.onFormOpen?.(),He()?.emit("openFeedbackWidget"),E.body.style.overflow="hidden"}},close(){_(),i()}},y=t?.createInput({h:m,hooks:Xr,dialog:h,options:e}),v=g=>{ht(m(_n,{options:e,screenshotInput:y,showName:e.showName||e.isNameRequired,showEmail:e.showEmail||e.isEmailRequired,defaultName:String(o&&l?.[o.name]||""),defaultEmail:String(o&&l?.[o.email]||""),onFormClose:()=>{h.close(),e.onFormClose?.()},onSubmit:r,onSubmitSuccess:(p,T)=>{_(),e.onSubmitSuccess?.(p,T)},onSubmitError:p=>{e.onSubmitError?.(p)},onFormSubmitted:()=>{e.onFormSubmitted?.()},open:g}),u)};return h}}));function yn({h:e}){return function(){return e("svg",{"data-test-id":"icon-close",viewBox:"0 0 16 16",fill:"#2B2233",height:"25px",width:"25px"},e("circle",{r:"7",cx:"8",cy:"8",fill:"white"}),e("path",{strokeWidth:"1.5",d:"M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z"}),e("path",{strokeWidth:"1.5",d:"M5.34,11.41a.71.71,0,0,1-.53-.22.74.74,0,0,1,0-1.06l5.32-5.32a.75.75,0,0,1,1.06,1.06L5.87,11.19A.74.74,0,0,1,5.34,11.41Z"}),e("path",{strokeWidth:"1.5",d:"M10.66,11.41a.74.74,0,0,1-.53-.22L4.81,5.87A.75.75,0,0,1,5.87,4.81l5.32,5.32a.74.74,0,0,1,0,1.06A.71.71,0,0,1,10.66,11.41Z"}))}}function wn(e){const t=E.createElement("style"),r="#1A141F",n="#302735";return t.textContent=`
.editor {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
}

.editor__image-container {
  justify-items: center;
  padding: 15px;
  position: relative;
  height: 100%;
  border-radius: var(--menu-border-radius, 6px);

  background-color: ${r};
  background-image: repeating-linear-gradient(
      -145deg,
      transparent,
      transparent 8px,
      ${r} 8px,
      ${r} 11px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 15px,
      ${n} 15px,
      ${n} 16px
    );
}

.editor__canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor__canvas-container > * {
  object-fit: contain;
  position: absolute;
}

.editor__tool-container {
  padding-top: 8px;
  display: flex;
  justify-content: center;
}

.editor__tool-bar {
  display: flex;
  gap: 8px;
}

.editor__tool {
  display: flex;
  padding: 8px 12px;
  justify-content: center;
  align-items: center;
  border: var(--button-border, var(--border));
  border-radius: var(--button-border-radius, 6px);
  background: var(--button-background, var(--background));
  color: var(--button-color, var(--foreground));
}

.editor__tool--active {
  background: var(--button-primary-background, var(--accent-background));
  color: var(--button-primary-color, var(--accent-foreground));
}

.editor__rect {
  position: absolute;
  z-index: 2;
}

.editor__rect button {
  opacity: 0;
  position: absolute;
  top: -12px;
  right: -12px;
  cursor: pointer;
  padding: 0;
  z-index: 3;
  border: none;
  background: none;
}

.editor__rect:hover button {
  opacity: 1;
}
`,e&&t.setAttribute("nonce",e),t}function En({h:e}){return function({action:r,setAction:n,options:a}){return e("div",{class:"editor__tool-container"},e("div",{class:"editor__tool-bar"},e("button",{type:"button",class:`editor__tool ${r==="highlight"?"editor__tool--active":""}`,onClick:()=>{n(r==="highlight"?"":"highlight")}},a.highlightToolText),e("button",{type:"button",class:`editor__tool ${r==="hide"?"editor__tool--active":""}`,onClick:()=>{n(r==="hide"?"":"hide")}},a.hideToolText)))}}const xn=2,Cn=300;function Sn(e,t){return new Promise(r=>{const n=setTimeout(r,t);let a=e;const o=()=>{if(a-=1,a>0){H.requestAnimationFrame(o);return}clearTimeout(n),r()};H.requestAnimationFrame(o)})}function kn({hooks:e}){function t(){const[r,n]=e.useState(H.devicePixelRatio??1);return e.useEffect(()=>{const a=()=>{n(H.devicePixelRatio)},o=matchMedia(`(resolution: ${H.devicePixelRatio}dppx)`);return o.addEventListener("change",a),()=>{o.removeEventListener("change",a)}},[]),r}return function({onBeforeScreenshot:n,onScreenshot:a,onAfterScreenshot:o,onError:l}){const u=t();e.useEffect(()=>{(async()=>{n(),await Sn(xn,Cn);const c=await he.mediaDevices.getDisplayMedia({video:{width:H.innerWidth*u,height:H.innerHeight*u},audio:!1,monitorTypeSurfaces:"exclude",preferCurrentTab:!0,selfBrowserSurface:"include",surfaceSwitching:"exclude"}),s=E.createElement("video");await new Promise((d,i)=>{s.srcObject=c,s.onloadedmetadata=()=>{a(s,u),c.getTracks().forEach(_=>_.stop()),d()},s.play().catch(i)}),o()})().catch(l)},[])}}function Rn(e,t,r){switch(e.type){case"highlight":t.save(),t.shadowColor="rgba(0, 0, 0, 0.7)",t.shadowBlur=50,t.fillStyle=r,t.fillRect(e.x-1,e.y-1,e.w+2,e.h+2),t.clearRect(e.x,e.y,e.w,e.h),t.restore();break;case"hide":t.fillStyle="rgb(0, 0, 0)",t.fillRect(e.x,e.y,e.w,e.h)}}function Q(e,t,r){if(!e)return;const n=e.getContext("2d",t);n&&r(e,n)}function ze(e,t){Q(e,{alpha:!0},(r,n)=>{n.drawImage(t,0,0,t.width,t.height,0,0,r.width,r.height)})}function We(e,t,r){Q(e,{alpha:!0},(n,a)=>{r.length&&(a.fillStyle="rgba(0, 0, 0, 0.25)",a.fillRect(0,0,n.width,n.height)),r.forEach(o=>{Rn(o,a,t)})})}function Tn({h:e,hooks:t,outputBuffer:r,dialog:n,options:a}){const o=kn({hooks:t}),l=En({h:e}),u=yn({h:e}),f={__html:wn(a.styleNonce).innerText},c=n.el.style,s=({screenshot:d})=>{const[i,_]=t.useState("highlight"),[h,y]=t.useState([]),v=t.useRef(null),g=t.useRef(null),p=t.useRef(null),T=t.useRef(null),[k,O]=t.useState(1),D=t.useMemo(()=>{const b=E.getElementById(a.id);if(!b)return"white";const w=getComputedStyle(b);return w.getPropertyValue("--button-primary-background")||w.getPropertyValue("--accent-background")},[a.id]);t.useLayoutEffect(()=>{const b=()=>{const w=v.current;w&&(Q(d.canvas,{alpha:!1},A=>{const $=Math.min(w.clientWidth/A.width,w.clientHeight/A.height);O($)}),(w.clientHeight===0||w.clientWidth===0)&&setTimeout(b,0))};return b(),H.addEventListener("resize",b),()=>{H.removeEventListener("resize",b)}},[d]);const q=t.useCallback((b,w)=>{Q(b,{alpha:!0},(A,$)=>{$.scale(w,w),A.width=d.canvas.width,A.height=d.canvas.height})},[d]);t.useEffect(()=>{q(g.current,d.dpi),ze(g.current,d.canvas)},[d]),t.useEffect(()=>{q(p.current,d.dpi),Q(p.current,{alpha:!0},(b,w)=>{w.clearRect(0,0,b.width,b.height)}),We(p.current,D,h)},[h,D]),t.useEffect(()=>{q(r,d.dpi),ze(r,d.canvas),Q(E.createElement("canvas"),{alpha:!0},(b,w)=>{w.scale(d.dpi,d.dpi),b.width=d.canvas.width,b.height=d.canvas.height,We(b,D,h),ze(r,b)})},[h,d,D]);const N=b=>{if(!i||!T.current)return;const w=T.current.getBoundingClientRect(),A={type:i,x:(b.clientX-w.x)/k,y:(b.clientY-w.y)/k},$=(P,B)=>{const M=(B.clientX-w.x)/k,z=(B.clientY-w.y)/k;return{type:P.type,x:Math.min(P.x,M),y:Math.min(P.y,z),w:Math.abs(M-P.x),h:Math.abs(z-P.y)}},ee=P=>{Q(p.current,{alpha:!0},(B,M)=>{M.clearRect(0,0,B.width,B.height)}),We(p.current,D,[...h,$(A,P)])},le=P=>{const B=$(A,P);B.w*k>=1&&B.h*k>=1&&y(M=>[...M,B]),E.removeEventListener("mousemove",ee),E.removeEventListener("mouseup",le)};E.addEventListener("mousemove",ee),E.addEventListener("mouseup",le)},W=t.useCallback(b=>w=>{w.preventDefault(),w.stopPropagation(),y(A=>{const $=[...A];return $.splice(b,1),$})},[]),F={width:`${d.canvas.width*k}px`,height:`${d.canvas.height*k}px`},I=b=>{b.stopPropagation()};return e("div",{class:"editor"},e("style",{nonce:a.styleNonce,dangerouslySetInnerHTML:f}),e("div",{class:"editor__image-container"},e("div",{class:"editor__canvas-container",ref:v},e("canvas",{ref:g,id:"background",style:F}),e("canvas",{ref:p,id:"foreground",style:F}),e("div",{ref:T,onMouseDown:N,style:F},h.map((b,w)=>e("div",{key:w,class:"editor__rect",style:{top:`${b.y*k}px`,left:`${b.x*k}px`,width:`${b.w*k}px`,height:`${b.h*k}px`}},e("button",{"aria-label":a.removeHighlightText,onClick:W(w),onMouseDown:I,onMouseUp:I,type:"button"},e(u,null))))))),e(l,{options:a,action:i,setAction:_}))};return function({onError:i}){const[_,h]=t.useState();return o({onBeforeScreenshot:t.useCallback(()=>{c.display="none"},[]),onScreenshot:t.useCallback((y,v)=>{Q(E.createElement("canvas"),{alpha:!1},(g,p)=>{p.scale(v,v),g.width=y.videoWidth,g.height=y.videoHeight,p.drawImage(y,0,0,g.width,g.height),h({canvas:g,dpi:v})}),r.width=y.videoWidth,r.height=y.videoHeight},[]),onAfterScreenshot:t.useCallback(()=>{c.display="block"},[]),onError:t.useCallback(y=>{c.display="block",i(y)},[])}),_?e(s,{screenshot:_}):e("div",null)}}const Fn=(()=>({name:"FeedbackScreenshot",setupOnce(){},createInput:({h:e,hooks:t,dialog:r,options:n})=>{const a=E.createElement("canvas");return{input:Tn({h:e,hooks:t,outputBuffer:a,dialog:r,options:n}),value:async()=>{const o=await new Promise(l=>{a.toBlob(l,"image/png")});if(o)return{data:new Uint8Array(await o.arrayBuffer()),filename:"screenshot.png",contentType:"application/png"}}}}})),Ln=Br({getModalIntegration:()=>vn,getScreenshotIntegration:()=>Fn});let oe=null,kt=!1;rr(e=>{Xe()?.setTheme(e)});function Mn(){!kt&&!Xe()&&(Ve(Ln({id:"st-feedback-host",autoInject:!1,colorScheme:je.effectiveScheme,enableScreenshot:!0,showBranding:!1,showName:!0,isNameRequired:!1,nameLabel:"Name (optional)",namePlaceholder:"Steam name or handle",showEmail:!0,isEmailRequired:!1,emailLabel:"Email (optional)",emailPlaceholder:"Only if you want a reply",formTitle:"Send Feedback / Report a Bug",messageLabel:"Description",messagePlaceholder:"What's broken or could be better? Feel free to attach a screenshot below.",submitButtonLabel:"Send Feedback",successMessageText:"Thanks! Your feedback has been sent.",themeLight:{foreground:"#1c2024",background:"#ffffff",accentForeground:"#ffffff",accentBackground:"#1a66ad",successColor:"#1d6f42",errorColor:"#b92d27",boxShadow:"0 8px 24px rgba(20, 26, 33, 0.35)"},themeDark:{foreground:"#e6ecf2",background:"#1d232c",accentForeground:"#ffffff",accentBackground:"#206eb9",successColor:"#54c786",errorColor:"#f2746d",boxShadow:"0 8px 24px rgba(0, 0, 0, 0.68)"},onFormSubmitted:()=>{oe&&(oe.removeFromDom(),oe=null)}})),kt=!0);const e=Xe();return e?.setTheme(je.effectiveScheme),e}async function In(){lr({allowLocalPreview:!0});const e=Mn();if(!e)return;const t=lt.currencies[lt.curIndex]?.name;cr({route:tr.currentRoute,theme:je.effectiveScheme,currency:t}),oe||(oe=await e.createForm()),oe.appendToDom(),oe.open()}export{In as openSentryFeedback};

//# debugId=590b1cd0-cdb4-419d-a42c-749d46086573
