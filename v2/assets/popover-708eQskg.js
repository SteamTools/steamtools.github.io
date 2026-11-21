var G=globalThis.Event||class{},k=class extends G{oldState;newState;constructor(e,t={}){const o=Object.assign({},t);delete o.oldState,delete o.newState,super(e,o),this.oldState=String(t.oldState||""),this.newState=String(t.newState||"")}},W=new WeakMap;function $(e,t,o){W.set(e,setTimeout(()=>{W.has(e)&&e.dispatchEvent(new k("toggle",{cancelable:!1,oldState:t,newState:o}))},0))}var N=globalThis.ShadowRoot||function(){},K=globalThis.HTMLDialogElement||function(){},A=new WeakMap,d=new WeakMap,f=new WeakMap,y=new WeakMap;function P(e){return y.get(e)||"hidden"}var M=new WeakMap;function m(e){return[...e].pop()}function Q(e){const t=e.popoverTargetElement;if(!(t instanceof HTMLElement))return;const o=P(t);e.popoverTargetAction==="show"&&o==="showing"||e.popoverTargetAction==="hide"&&o==="hidden"||(o==="showing"?E(t,!0,!0):g(t,!1)&&(M.set(t,e),I(t)))}function g(e,t){return!(e.popover!=="auto"&&e.popover!=="manual"&&e.popover!=="hint"||!e.isConnected||t&&P(e)!=="showing"||!t&&P(e)!=="hidden"||e instanceof K&&e.hasAttribute("open")||document.fullscreenElement===e)}function _(e){if(!e)return 0;const t=d.get(document)||new Set,o=f.get(document)||new Set;return o.has(e)?[...o].indexOf(e)+t.size+1:t.has(e)?[...t].indexOf(e)+1:0}function J(e){const t=U(e),o=X(e);return _(t)>_(o)?t:o}function L(e){let t;const o=f.get(e)||new Set,n=d.get(e)||new Set,r=o.size>0?o:n.size>0?n:null;return r?(t=m(r),t.isConnected?t:(r.delete(t),L(e))):null}function q(e){for(const t of e||[])if(!t.isConnected)e.delete(t);else return t;return null}function S(e){return typeof e.getRootNode=="function"?e.getRootNode():e.parentNode?S(e.parentNode):e}function U(e){for(;e;){if(e instanceof HTMLElement&&e.popover==="auto"&&y.get(e)==="showing")return e;if(e=e instanceof Element&&e.assignedSlot||e.parentElement||S(e),e instanceof N&&(e=e.host),e instanceof Document)return}}function X(e){for(;e;){const t=e.popoverTargetElement;if(t instanceof HTMLElement)return t;if(e=e.parentElement||S(e),e instanceof N&&(e=e.host),e instanceof Document)return}}function j(e,t){const o=new Map;let n=0;for(const l of t||[])o.set(l,n),n+=1;o.set(e,n),n+=1;let r=null;function a(l){if(!l)return;let p=!1,u=null;for(;!p;){if(u=U(l)||null,u===null||!o.has(u))return;(e.popover==="hint"||u.popover==="auto")&&(p=!0),p||(l=u.parentElement)}const i=o.get(u)??null;(r===null||o.get(r)<i)&&(r=u)}return a(e.parentElement||S(e)),r}function Z(e){return e.hidden||e instanceof N||(e instanceof HTMLButtonElement||e instanceof HTMLInputElement||e instanceof HTMLSelectElement||e instanceof HTMLTextAreaElement||e instanceof HTMLOptGroupElement||e instanceof HTMLOptionElement||e instanceof HTMLFieldSetElement)&&e.disabled||e instanceof HTMLInputElement&&e.type==="hidden"||e instanceof HTMLAnchorElement&&e.href===""?!1:typeof e.tabIndex=="number"&&e.tabIndex!==-1}function ee(e){if(e.shadowRoot&&e.shadowRoot.delegatesFocus!==!0)return null;let t=e;t.shadowRoot&&(t=t.shadowRoot);let o=t.querySelector("[autofocus]");if(o)return o;{const a=t.querySelectorAll("slot");for(const l of a){const p=l.assignedElements({flatten:!0});for(const u of p){if(u.hasAttribute("autofocus"))return u;if(o=u.querySelector("[autofocus]"),o)return o}}}const n=e.ownerDocument.createTreeWalker(t,NodeFilter.SHOW_ELEMENT);let r=n.currentNode;for(;r;){if(Z(r))return r;r=n.nextNode()}}function te(e){var t;(t=ee(e))==null||t.focus()}var T=new WeakMap;function I(e){if(!g(e,!1))return;const t=e.ownerDocument;if(!e.dispatchEvent(new k("beforetoggle",{cancelable:!0,oldState:"closed",newState:"open"}))||!g(e,!1))return;let o=!1;const n=e.popover;let r=null;const a=j(e,d.get(t)||new Set),l=j(e,f.get(t)||new Set);if(n==="auto"&&(R(f.get(t)||new Set,o,!0),w(a||t,o,!0),r="auto"),n==="hint"&&(l?(w(l,o,!0),r="hint"):(R(f.get(t)||new Set,o,!0),a?(w(a,o,!0),r="auto"):r="hint")),n==="auto"||n==="hint"){if(n!==e.popover||!g(e,!1))return;L(t)||(o=!0),r==="auto"?(d.has(t)||d.set(t,new Set),d.get(t).add(e)):r==="hint"&&(f.has(t)||f.set(t,new Set),f.get(t).add(e))}T.delete(e);const p=t.activeElement;e.classList.add(":popover-open"),y.set(e,"showing"),A.has(t)||A.set(t,new Set),A.get(t).add(e),Y(M.get(e),!0),te(e),o&&p&&e.popover==="auto"&&T.set(e,p),$(e,"closed","open")}function E(e,t=!1,o=!1){var n,r;if(!g(e,!0))return;const a=e.ownerDocument;if(["auto","hint"].includes(e.popover)&&(w(e,t,o),!g(e,!0)))return;const l=d.get(a)||new Set,p=l.has(e)&&m(l)===e;if(Y(M.get(e),!1),M.delete(e),o&&(e.dispatchEvent(new k("beforetoggle",{oldState:"open",newState:"closed"})),p&&m(l)!==e&&w(e,t,o),!g(e,!0)))return;(n=A.get(a))==null||n.delete(e),l.delete(e),(r=f.get(a))==null||r.delete(e),e.classList.remove(":popover-open"),y.set(e,"hidden"),o&&$(e,"open","closed");const u=T.get(e);u&&(T.delete(e),t&&u.focus())}function oe(e,t=!1,o=!1){let n=L(e);for(;n;)E(n,t,o),n=L(e)}function R(e,t=!1,o=!1){let n=q(e);for(;n;)E(n,t,o),n=q(e)}function z(e,t,o,n){let r=!1,a=!1;for(;r||!a;){a=!0;let l=null,p=!1;for(const u of t)if(u===e)p=!0;else if(p){l=u;break}if(!l)return;for(;P(l)==="showing"&&t.size;)E(m(t),o,n);t.has(e)&&m(t)!==e&&(r=!0),r&&(n=!1)}}function w(e,t,o){var n,r;const a=e.ownerDocument||e;if(e instanceof Document)return oe(a,t,o);if((n=f.get(a))!=null&&n.has(e)){z(e,f.get(a),t,o);return}R(f.get(a)||new Set,t,o),(r=d.get(a))!=null&&r.has(e)&&z(e,d.get(a),t,o)}var H=new WeakMap;function B(e){if(!e.isTrusted)return;const t=e.composedPath()[0];if(!t)return;const o=t.ownerDocument||t;if(!L(o))return;const r=J(t);if(r&&e.type==="pointerdown")H.set(o,r);else if(e.type==="pointerup"){const a=H.get(o)===r;H.delete(o),a&&w(r||o,!1,!0)}}var D=new WeakMap;function Y(e,t=!1){if(!e)return;D.has(e)||D.set(e,e.getAttribute("aria-expanded"));const o=e.popoverTargetElement;if(o instanceof HTMLElement&&o.popover==="auto")e.setAttribute("aria-expanded",String(t));else{const n=D.get(e);n?e.setAttribute("aria-expanded",n):e.removeAttribute("aria-expanded")}}var V=globalThis.ShadowRoot||function(){},ne="popover-polyfill";function re(){return typeof HTMLElement<"u"&&typeof HTMLElement.prototype=="object"&&"popover"in HTMLElement.prototype&&"showPopover"in HTMLElement.prototype}function v(e,t,o){const n=e[t];Object.defineProperty(e,t,{value(r){return n.call(this,o(r))}})}var ie=/(^|[^\\]):popover-open\b/g;function ae(){return typeof globalThis.CSSLayerBlockRule=="function"}function se(e){var t;const o=ae(),n=(((t=window.POPOVER_POLYFILL_OPTIONS)==null?void 0:t.layerName)??ne).split(".").map(r=>CSS.escape(r)).join(".");return`
${o?`@layer ${n} {`:""}
  :where([popover]) {
    position: fixed;
    z-index: 2147483647;
    inset: 0;
    padding: 0.25em;
    width: fit-content;
    height: fit-content;
    border-width: initial;
    border-color: initial;
    border-image: initial;
    border-style: solid;
    background-color: canvas;
    color: canvastext;
    overflow: auto;
    margin: auto;
  }

  :where([popover]:not(.\\:popover-open)) {
    display: none;
  }

  :where(dialog[popover].\\:popover-open) {
    display: block;
  }

  :where(dialog[popover][open]) {
    display: revert;
  }

  :where([anchor].\\:popover-open) {
    inset: auto;
  }

  :where([anchor]:popover-open) {
    inset: auto;
  }

  @supports not (background-color: canvas) {
    :where([popover]) {
      background-color: white;
      color: black;
    }
  }

  @supports (width: -moz-fit-content) {
    :where([popover]) {
      width: -moz-fit-content;
      height: -moz-fit-content;
    }
  }

  @supports not (inset: 0) {
    :where([popover]) {
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
  }
${o?"}":""}
`}var b=null;function O(e,t){const o=se();if(b===null)try{b=new CSSStyleSheet,b.replaceSync(o)}catch{b=!1}if(b===!1||!e.adoptedStyleSheets){const n=document.createElement("style");n.textContent=o,e instanceof Document?e.head.prepend(n):e.prepend(n)}else e.adoptedStyleSheets=[b,...e.adoptedStyleSheets]}function le(e){if(typeof window>"u")return;window.ToggleEvent=window.ToggleEvent||k;function t(i){return i?.includes(":popover-open")&&(i=i.replace(ie,"$1.\\:popover-open")),i}v(Document.prototype,"querySelector",t),v(Document.prototype,"querySelectorAll",t),v(Element.prototype,"querySelector",t),v(Element.prototype,"querySelectorAll",t),v(Element.prototype,"matches",t),v(Element.prototype,"closest",t),v(DocumentFragment.prototype,"querySelectorAll",t),Object.defineProperties(HTMLElement.prototype,{popover:{enumerable:!0,configurable:!0,get(){if(!this.hasAttribute("popover"))return null;const i=(this.getAttribute("popover")||"").toLowerCase();return i===""||i=="auto"?"auto":i=="hint"?"hint":"manual"},set(i){i===null?this.removeAttribute("popover"):this.setAttribute("popover",i)}},showPopover:{enumerable:!0,configurable:!0,writable:!0,value(i={}){I(this)}},hidePopover:{enumerable:!0,configurable:!0,writable:!0,value(){E(this,!0,!0)}},togglePopover:{enumerable:!0,configurable:!0,writable:!0,value(i={}){return typeof i=="boolean"&&(i={force:i}),y.get(this)==="showing"&&i.force===void 0||i.force===!1?E(this,!0,!0):(i.force===void 0||i.force===!0)&&I(this),y.get(this)==="showing"}}});const o=Element.prototype.attachShadow;o&&Object.defineProperties(Element.prototype,{attachShadow:{enumerable:!0,configurable:!0,writable:!0,value(i){const s=o.call(this,i);return O(s),s}}});const n=HTMLElement.prototype.attachInternals;n&&Object.defineProperties(HTMLElement.prototype,{attachInternals:{enumerable:!0,configurable:!0,writable:!0,value(){const i=n.call(this);return i.shadowRoot&&O(i.shadowRoot),i}}});const r=new WeakMap;function a(i){Object.defineProperties(i.prototype,{popoverTargetElement:{enumerable:!0,configurable:!0,set(s){if(s===null)this.removeAttribute("popovertarget"),r.delete(this);else if(s instanceof Element)this.setAttribute("popovertarget",""),r.set(this,s);else throw new TypeError("popoverTargetElement must be an element or null")},get(){if(this.localName!=="button"&&this.localName!=="input"||this.localName==="input"&&this.type!=="reset"&&this.type!=="image"&&this.type!=="button"||this.disabled||this.form&&this.type==="submit")return null;const s=r.get(this);if(s&&s.isConnected)return s;if(s&&!s.isConnected)return r.delete(this),null;const c=S(this),h=this.getAttribute("popovertarget");return(c instanceof Document||c instanceof V)&&h&&c.getElementById(h)||null}},popoverTargetAction:{enumerable:!0,configurable:!0,get(){const s=(this.getAttribute("popovertargetaction")||"").toLowerCase();return s==="show"||s==="hide"?s:"toggle"},set(s){this.setAttribute("popovertargetaction",s)}}})}a(HTMLButtonElement),a(HTMLInputElement);const l=i=>{if(i.defaultPrevented)return;const s=i.composedPath(),c=s[0];if(!(c instanceof Element)||c?.shadowRoot)return;const h=S(c);if(!(h instanceof V||h instanceof Document))return;const x=s.find(F=>{var C;return(C=F.matches)==null?void 0:C.call(F,"[popovertargetaction],[popovertarget]")});if(x){Q(x),i.preventDefault();return}},p=i=>{const s=i.key,c=i.target;if(!i.defaultPrevented&&c&&(s==="Escape"||s==="Esc")){const h=c.ownerDocument||c;w(h,!0,!0)}};(i=>{i.addEventListener("click",l),i.addEventListener("keydown",p),i.addEventListener("pointerdown",B),i.addEventListener("pointerup",B)})(document),O(document)}re()||le();
