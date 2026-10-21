/*
 * Page information for the "page view" dataLayer push, for both Mendix clients.
 *
 * Dojo client: mx.ui.getContentForm() was the current content page (title, path, url).
 * React client (Mendix 10/11): mx.ui.getContentForm does not exist. The router does, for every
 * content page (also on back/forward):
 *     window.history.pushState({ id, pageName, formParameters, customTitle, params }, "", newUrl)
 *     document.title = pageTitle ? `${applicationTitle} - ${pageTitle}` : applicationTitle
 * and only then renders the new page, so both are in place when a widget on that page mounts.
 *   - pageName is "Module.Page" ("HomeScan/HomeScan_Step.page.xml" with "/" -> "." and no extension)
 *   - customTitle is the title override of the Show page action (undefined when there is none)
 *   - params.url is the page URL the server sent along (microflow Show page); newUrl is the page's
 *     own URL with the parameters filled in, or the unchanged current path when the page has no URL
 *   - applicationTitle = mx.session.getConfig("uiconfig.profile.title")
 *
 * Every access below is guarded: none of these helpers can throw; a value that cannot be
 * determined is "".
 */

const PAGE_EXTENSION = ".page.xml";
const TITLE_SEPARATOR = " - ";

function safe(fn, fallback) {
    try {
        const value = fn();
        return value === undefined || value === null ? fallback : value;
    } catch {
        return fallback;
    }
}

function asString(value) {
    return typeof value === "string" ? value : "";
}

function globals() {
    return {
        win: typeof window !== "undefined" ? window : undefined,
        doc: typeof document !== "undefined" ? document : undefined,
        mxGlobal: typeof mx !== "undefined" ? mx : undefined // eslint-disable-line no-undef
    };
}

/** The Dojo client's current content form, or undefined (React client). */
function getDojoContentForm(mxGlobal) {
    return safe(() => {
        if (mxGlobal && mxGlobal.ui && typeof mxGlobal.ui.getContentForm === "function") {
            return mxGlobal.ui.getContentForm() || undefined;
        }
        return undefined;
    }, undefined);
}

/** The React client's history entry for the current content page ({} when unknown). */
function getHistoryState(win) {
    return safe(() => {
        const state = win.history.state;
        return state && typeof state === "object" ? state : {};
    }, {});
}

/** Identity of the current page view (a new id per opened page, also when the same page opens again). */
export function getPageViewId(env) {
    const { win } = env || globals();
    const state = getHistoryState(win);
    return safe(() => (state.id === undefined || state.id === null ? "" : String(state.id)), "");
}

function getApplicationTitle(mxGlobal) {
    return safe(() => asString(mxGlobal.session.getConfig("uiconfig.profile.title")), "");
}

/**
 * Page title without the application title, e.g. "Scan - Advies" -> "Advies".
 * JS_SetTitle (MxCore) may have replaced the leading "Scan" with a partner name
 * ("Partner B.V. - Advies"); then the part after the last " - " is the page title
 * (no page title in this app contains " - "; a partner name might).
 */
export function stripApplicationTitle(documentTitle, applicationTitle) {
    const title = asString(documentTitle);
    const appTitle = asString(applicationTitle);
    if (!title) {
        return "";
    }
    if (appTitle) {
        if (title === appTitle) {
            return ""; // page without a title
        }
        if (title.startsWith(appTitle + TITLE_SEPARATOR)) {
            return title.substring(appTitle.length + TITLE_SEPARATOR.length);
        }
    }
    const index = title.lastIndexOf(TITLE_SEPARATOR);
    return index >= 0 ? title.substring(index + TITLE_SEPARATOR.length) : "";
}

export function getPageTitle(env) {
    const { win, doc, mxGlobal } = env || globals();
    const dojoForm = getDojoContentForm(mxGlobal);
    if (dojoForm) {
        return safe(() => asString(dojoForm.title), "");
    }
    const state = getHistoryState(win);
    if (typeof state.customTitle === "string") {
        return state.customTitle; // what the router used for document.title
    }
    const documentTitle = safe(() => doc.title, "");
    return stripApplicationTitle(documentTitle, getApplicationTitle(mxGlobal));
}

/** "Module/Page", as the Dojo widget sent it (form path without ".page.xml"). */
export function getModuleLocation(env) {
    const { win, mxGlobal } = env || globals();
    const dojoForm = getDojoContentForm(mxGlobal);
    let path = dojoForm ? safe(() => asString(dojoForm.path), "") : "";
    if (!path) {
        const state = getHistoryState(win);
        // a nanoflow Show page stores the Dojo-style path in params.name
        path = safe(() => asString(state.params.name), "");
        if (!path) {
            const pageName = asString(state.pageName); // "Module.Page"
            path = pageName ? pageName.replace(".", "/") : "";
        }
    }
    return path.endsWith(PAGE_EXTENSION) ? path.substring(0, path.length - PAGE_EXTENSION.length) : path;
}

/** The page's own URL (path) when known, else "" (page without URL, or not known). */
function getPagePath(win, mxGlobal) {
    const dojoForm = getDojoContentForm(mxGlobal);
    if (dojoForm) {
        return safe(() => asString(dojoForm.url), "");
    }
    const state = getHistoryState(win);
    const configuredUrl = safe(() => asString(state.params.url), "");
    if (configuredUrl) {
        // the page has a URL: the router has already put it, parameters filled in, in the address bar
        return safe(() => asString(win.location.pathname), "");
    }
    return "";
}

function trimTrailingNumber(fullURL) {
    const lastCharIndex = fullURL.lastIndexOf("/");
    const endString = fullURL.substring(lastCharIndex + 1, fullURL.length);
    if (isNaN(endString)) {
        return fullURL; // the end of the string isn't a number, return the whole thing
    } else {
        return fullURL.substr(0, lastCharIndex); // the end of the string is a number, trim it
    }
}

export function getPageURL(env) {
    const { win, mxGlobal } = env || globals();
    const origin = safe(() => asString(win.location.origin), "");
    const pageURL = origin + getPagePath(win, mxGlobal);
    return pageURL ? trimTrailingNumber(pageURL) : "";
}

export function getSessionID(env) {
    const { mxGlobal } = env || globals();
    return safe(() => {
        const id = mxGlobal.session.getSessionObjectId();
        return id === undefined || id === null ? "" : String(id);
    }, "");
}

/** The dataLayer object; field names and order as in GTMloader 1.1.0. Never throws. */
export function createDataLayer(props, env) {
    const environment = env || globals();
    const p = props || {};
    const dataLayer = { event: safe(() => String(p.pageViewEventName), "") };

    if (p.sendPageTitle) {
        dataLayer["Page Name"] = safe(() => getPageTitle(environment), "");
    }
    if (p.sendModuleLocation) {
        dataLayer["Module Location"] = safe(() => getModuleLocation(environment), "");
    }
    if (p.sendPageURL) {
        dataLayer["Page URL"] = safe(() => getPageURL(environment), "");
    }
    if (p.sendSessionID) {
        dataLayer["Session ID"] = safe(() => getSessionID(environment), "");
    }
    if (p.sendAdditionalProps) {
        const additionalProps = safe(() => Array.from(p.additionalProps), []);
        for (const object of additionalProps) {
            const name = safe(() => String(object.propName), "");
            const value = safe(() => String(object.propValue.value || ""), "");
            dataLayer[name] = (value + ", ").replace(/,\s*$/, "");
        }
    }
    return dataLayer;
}
