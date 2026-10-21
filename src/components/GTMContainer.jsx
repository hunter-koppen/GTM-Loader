import { Component, createElement } from "react";

import { createDataLayer, getPageViewId } from "./pageInfo";

import TagManager from "react-gtm-module";

export class GTMContainer extends Component {
    init = false;
    prevDataLayer = null;
    prevPageViewId = null;
    pushTimer = null;
    unmounted = false;

    componentDidMount() {
        this.unmounted = false;
        this.checkInit();

        // in case loading was already done, push data immediatly
        if (this.init) {
            this.pushData();
        }
    }

    componentDidUpdate() {
        this.checkInit();
        this.pushData();
    }

    checkInit = () => {
        const dataAvailable = this.checkDataAvailability();
        if (dataAvailable) {
            if (!this.init) {
                for (const object of this.props.gtmCodes) {
                    if (object.gtmCode.value) {
                        const gtmId = object.gtmCode.value;
                        const gtmScriptBaseSrc = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;

                        // Check if the GTM script for this ID is already present in the DOM
                        const isGtmLoaded = Array.from(document.getElementsByTagName("script")).some(
                            script => script.src && script.src.startsWith(gtmScriptBaseSrc)
                        );

                        if (!isGtmLoaded) {
                            const tagManagerArgsInitialize = {
                                gtmId: gtmId
                            };
                            TagManager.initialize(tagManagerArgsInitialize);
                            console.log(`GTM container with ID ${gtmId} initialized.`);
                        } else {
                            console.log(`GTM container with ID ${gtmId} is already loaded.`);
                        }
                    }
                }
                this.init = true;
            }
        }
    };

    checkDataAvailability = () => {
        for (const object of this.props.gtmCodes) {
            if (object.gtmCode.status === "loading") {
                return false;
            }
        }
        for (const object of this.props.additionalProps) {
            if (object.propValue.status === "loading") {
                return false;
            }
        }
        return true;
    };

    // Works in the Dojo and the React client; never throws (see pageInfo.js).
    createData = () => createDataLayer(this.props);

    // The push is deferred to the next task: the React client sets history.state and
    // document.title before it renders the new page, so both are in place by then. Deferring
    // also coalesces the updates of one render, and skips a push that was scheduled for a page
    // that has meanwhile been replaced (its widget is about to unmount; the new page pushes).
    pushData = () => {
        if (this.pushTimer !== null) {
            clearTimeout(this.pushTimer);
        }
        const scheduledForPageViewId = getPageViewId();
        this.pushTimer = setTimeout(() => {
            this.pushTimer = null;
            if (this.unmounted) {
                return;
            }
            try {
                const pageViewId = getPageViewId();
                if (pageViewId !== scheduledForPageViewId) {
                    return;
                }
                const dataAvailable = this.checkDataAvailability();
                if (dataAvailable) {
                    if (pageViewId !== this.prevPageViewId) {
                        // a newly opened page (also the same page again) is a new page view
                        this.prevPageViewId = pageViewId;
                        this.prevDataLayer = null;
                    }
                    const dataLayer = this.createData();
                    if (JSON.stringify(this.prevDataLayer) !== JSON.stringify(dataLayer)) {
                        this.prevDataLayer = dataLayer; // Update prevDataLayer to the latest
                        TagManager.dataLayer({ dataLayer });
                    }
                }
            } catch (e) {
                console.error("GTMloader: page view not sent to the dataLayer.", e);
            }
        }, 0);
    };

    componentWillUnmount() {
        this.unmounted = true;
        if (this.pushTimer !== null) {
            clearTimeout(this.pushTimer);
            this.pushTimer = null;
        }
    }

    render() {
        return null;
    }
}
