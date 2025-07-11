import React from "react";
import { createRoot } from "react-dom/client";
import {
  callPrompt,
  explainCode,
  explainSentence,
  explainWord,
  ocr,
  rewriteCode,
  summariseLink,
} from "~/ai/ai";
import { ChatUI } from "~components/ChatUI";
import { KnowledgeCardUI } from "~components/KnowledgeCardUI";
import { Loading } from "~components/Loading";
import { MindmapUI } from "~components/MindmapUI";
import { ThinkingUI } from "~components/ThinkingUI";
import type { QuickPrompt } from "~utils/storage";
import { ExportDialog } from "./components/ExportDialog";
import { TSWPanel } from "./components/TSWPanel";
import { iconArray } from "./content";

const panelRoots = new Map<string, ReturnType<typeof createRoot>>();
let globalShadowRoot: ShadowRoot | null = null;
let panelRoot: ReturnType<typeof createRoot> | null = null;

function withOutputPanel(
  outputElm: string,
  cssText: string,
  title: string,
  handler: () => void,
  children: (shadowRoot?: ShadowRoot) => React.ReactNode,
  currentTop?: number,
) {
  const { wrapper, innerWrapper, header } = setupWrapperAndBody(currentTop);

  let panel = document.getElementById(outputElm);

  if (!panel) {
    panel = document.createElement("div");
    panel.id = outputElm;
    panel.style.cssText = `
    color-scheme: light;
    width: 37vw;
    height: 97vh;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 10px;
    position: fixed;
    right: 10px;
    top: 0px;
    margin-top: 5px;
    border-radius: 10px;
    display:none;
    z-index:1000 !important;
  `;
  }

  document.body.appendChild(panel);

  panel.style.boxShadow = "-2px 0 5px rgba(0,0,0,0.1)";
  panel.style.display = "block";
  panel.innerHTML = "";

  globalShadowRoot = panel.shadowRoot;
  if (!globalShadowRoot) {
    globalShadowRoot = panel.attachShadow({ mode: "open" });
    const stylePanel = document.createElement("style");
    stylePanel.textContent = `body{all:unset;}\n${cssText}`;
    globalShadowRoot.appendChild(stylePanel);
  }

  const oldPanel = globalShadowRoot.getElementById("tsw-panel-root");
  if (oldPanel) {
    oldPanel.remove();
  }

  panelRoot = createRoot(globalShadowRoot);
  panelRoots.set(outputElm, panelRoot);
  panelRoot.render(
    React.createElement(TSWPanel, {
      title: title,
      children: children(globalShadowRoot),
      onRender: () => {
        const closeButton = globalShadowRoot.querySelector(
          "#tsw-close-right-part",
        );
        if (closeButton) {
          closeButton.addEventListener("click", () => {
            resetWrapperCss(wrapper, innerWrapper, header, panel);
          });
        }

        for (const icon of iconArray) {
          const button = globalShadowRoot.querySelector(
            `#tsw-${icon.name.toLowerCase()}-btn`,
          );
          if (button) {
            button.addEventListener("click", () => {
              icon.action();
              if (icon.name.toLowerCase() === "wand") {
                resetWrapperCss(wrapper, innerWrapper, header, panel);
              }
            });
          }
        }

        handler();
      },
    }),
  );
}

function setupWrapperAndBody(currentTop: number): {
  wrapper: HTMLElement;
  innerWrapper: HTMLElement;
  header: HTMLElement;
  originalHeaderWidth?: string;
} {
  let wrapper = document.getElementById("tsw-outer-wrapper");
  const innerWrapper = document.createElement("div");

  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.id = "tsw-outer-wrapper";
    innerWrapper.id = "tsw-inner-wrapper";

    const bodyClasses = document.body.className;
    const bodyAttributes = Array.from(document.body.attributes);

    const newBody = document.createElement("body");
    newBody.className = bodyClasses;
    for (const attr of bodyAttributes) {
      newBody.setAttribute(attr.name, attr.value);
    }

    while (document.body.firstChild) {
      newBody.appendChild(document.body.firstChild);
    }

    innerWrapper.appendChild(newBody);
    wrapper.appendChild(innerWrapper);
    document.body.appendChild(wrapper);
  }

  wrapper.style.cssText = `
    width: 100%;
    height: 100%;
    position: fixed;
    top: 0;
    left: 0;
    transition: all 0.3s ease;
    box-shadow: 2px 0 5px rgba(0,0,0,0.1);
    overflow: scroll;
    margin-right:10px;
  `;

  const scrollPosition = {
    x: window.scrollX,
    y: currentTop ? currentTop : window.scrollY,
  };
  wrapper.scrollLeft = scrollPosition.x;
  wrapper.scrollTop = scrollPosition.y;

  const newWidth = "60vw";
  wrapper.style.width = newWidth;
  innerWrapper.style.cssText = `
          width: 80vw;
          height: 100vh;
      `;
  let header = document.querySelector("header");
  let originalHeaderWidth: string | undefined;
  if (header && header instanceof HTMLElement) {
    const headerStyle = window.getComputedStyle(header);
    if (headerStyle.position === "fixed") {
      originalHeaderWidth = headerStyle.width;
      header.style.width = "60vw";
    } else {
      header = null;
    }
  }

  window.dispatchEvent(new Event("resize"));

  return { wrapper, innerWrapper, header, originalHeaderWidth };
}

function cleanupPanel(outputElm: string) {
  console.log("cleanupPanel", outputElm);
  const root = panelRoots.get(outputElm);
  if (root) {
    try {
      root.unmount();
    } catch (e) {
      console.warn("Failed to unmount root:", e);
    }
    panelRoots.delete(outputElm);
  }
}

function resetWrapperCss(
  wrapper: HTMLElement,
  innerWrapper: HTMLElement,
  header: HTMLElement,
  panel: HTMLElement,
  originalHeaderWidth?: string,
) {
  wrapper.removeEventListener("scroll", (e) => {
    const target = e.target as HTMLElement;
    window.scrollTo(target.scrollLeft, target.scrollTop);
  });

  const scrollPosition = {
    x: wrapper.scrollLeft,
    y: wrapper.scrollTop,
  };
  cleanupPanel(panel.id);
  panel.style.display = "none";
  wrapper.style.cssText = `
    width: 100%;
    height: 100%;
    position: static;
    transition: all 0.3s ease;
    box-shadow: none;
    overflow: visible;
    margin-right: 0;
  `;
  innerWrapper.style.cssText = `
    width: 100vw;
    overflow: visible;
    box-shadow: none;
  `;

  if (header) {
    if (originalHeaderWidth) {
      header.style.width = originalHeaderWidth;
    } else {
      header.style.width = "100vw";
    }
  }

  window.dispatchEvent(new Event("resize"));
  window.scrollTo(scrollPosition.x, scrollPosition.y);
}

export async function summarize(outputElm: string) {
  withOutputPanel(
    outputElm,
    "",
    "Summary",
    async () => {
      const summaryElement = globalShadowRoot.getElementById("tsw-output-body");
      if (summaryElement) {
        const results = await summariseLink(
          document.body,
          window.location.href,
          summaryElement,
        );

        loadToolBar(summaryElement, results, globalShadowRoot);
      }
    },
    () =>
      React.createElement(Loading, {
        message: "Summarizing",
      }),
  );
}

const loadToolBar = (
  summaryElement: HTMLElement,
  results: string[],
  shadowRoot: ShadowRoot,
) => {
  const toolbarContainer = document.createElement("div");
  toolbarContainer.id = "tsw-toolbar";
  toolbarContainer.style.cssText = `
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.9);
    padding: 8px;
    display: none;
    border-radius: 6px;
    border: 1px solid #eee;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    z-index: 1000;
    transition: opacity 0.2s;
  `;

  const exportDialogRoot = document.createElement("div");
  exportDialogRoot.id = "export-dialog-container";
  toolbarContainer.appendChild(exportDialogRoot);
  summaryElement.appendChild(toolbarContainer);

  summaryElement.addEventListener("mouseenter", () => {
    toolbarContainer.style.display = "flex";
    toolbarContainer.style.opacity = "1";
  });

  summaryElement.addEventListener("mouseleave", () => {
    toolbarContainer.style.opacity = "0";
    setTimeout(() => {
      toolbarContainer.style.display = "none";
    }, 200);
  });
  console.log("shadowRoot  loadToolBar---", shadowRoot);
  createRoot(exportDialogRoot).render(
    React.createElement(ExportDialog, {
      content: results.map((el) => `${el}`).join(""),
      elementId: "tsw-output-body",
      title: "Summary",
      shadowRoot,
    }),
  );
};

export async function explainSelected(
  outputElm: string,
  text: string,
  currentTop: number,
  cssText: string,
) {
  const isWord = text.split(" ").length === 1;
  const title = isWord ? "单词释义" : "语法解析";

  withOutputPanel(
    outputElm,
    cssText,
    `${title}`,
    async () => {
      const explanationElement =
        globalShadowRoot.getElementById("tsw-output-body");
      if (explanationElement) {
        isWord
          ? await explainWord(text, explanationElement)
          : await explainSentence(text, explanationElement);
      }
    },
    () =>
      React.createElement(Loading, {
        message: "Explaining",
      }),
    currentTop,
  );
}

export async function ocrHandler(
  outputElm: string,
  imgSrc: string,
  postPrompt = "",
) {
  withOutputPanel(
    outputElm,
    "",
    "Text in Image",
    async () => {
      const imgContentElement =
        globalShadowRoot.getElementById("tsw-output-body");
      if (imgContentElement) {
        try {
          await ocr(imgSrc, imgContentElement, postPrompt);
        } catch (e) {
          imgContentElement.innerHTML = e as string;
        }
      }
    },
    () =>
      React.createElement(Loading, {
        message: "Processing",
      }),
  );
}

export function codeHandler(outputElm: string, code: string) {
  withOutputPanel(
    outputElm,
    "",
    "Code Block Explanation",
    async () => {
      const codeContentElement =
        globalShadowRoot.getElementById("tsw-output-body");
      if (codeContentElement) {
        await explainCode(code, codeContentElement);
      }
    },
    () =>
      React.createElement(Loading, {
        message: "Explaining",
      }),
  );
}

export function rewriteHandler(
  outputElm: string,
  code: string,
  targetLanguage: string,
) {
  withOutputPanel(
    outputElm,
    "",
    `Rewrite Code with ${targetLanguage}`,
    async () => {
      const codeContentElement =
        globalShadowRoot.getElementById("tsw-output-body");
      if (codeContentElement) {
        await rewriteCode(code, targetLanguage, codeContentElement);
      }
    },
    () =>
      React.createElement(Loading, {
        message: "Rewriting",
      }),
  );
}

export function chattingHandler(outputElm: string, cssText: string) {
  withOutputPanel(
    outputElm,
    cssText,
    "Chatting With Page",
    async () => {},
    (shadowRoot) =>
      React.createElement(ChatUI, {
        pageRoot: document.body,
        pageURL: window.location.href,
        shadowRoot, // 这里拿到的是最新的
      }),
  );
}

export function thinkingHandler(outputElm: string) {
  withOutputPanel(
    outputElm,
    "",
    "Thinking on Page",
    async () => {},
    (shadowRoot) =>
      React.createElement(ThinkingUI, {
        pageRoot: document.body,
        pageURL: window.location.href,
        shadowRoot,
      }),
  );
}

export async function callQuickPromptWithSelected(
  command: QuickPrompt,
  outputElm: string,
  textSelected: string,
  cssText: string,
) {
  withOutputPanel(
    outputElm,
    cssText,
    `Quick Prompt: ${command.name}`,
    async () => {
      const element = globalShadowRoot.getElementById("tsw-output-body");
      if (textSelected) {
        await callPrompt(
          command.prompt.replace("#input#", textSelected),
          command.system,
          element,
        );
      }
    },
    () =>
      React.createElement(Loading, {
        message: "Rewriting",
      }),
  );
}

export function knowledgeCardHandler(outputElm: string) {
  withOutputPanel(
    outputElm,
    "",
    "Knowledge Card",
    async () => {},
    () =>
      React.createElement(KnowledgeCardUI, {
        pageRoot: document.body,
        pageURL: window.location.href,
      }),
  );
}

export function mindmapHandler(outputElm: string) {
  withOutputPanel(
    outputElm,
    "",
    "Mindmap",
    async () => {},
    (shadowRoot) =>
      React.createElement(MindmapUI, {
        pageRoot: document.body,
        pageURL: window.location.href,
        shadowRoot,
      }),
  );
}
