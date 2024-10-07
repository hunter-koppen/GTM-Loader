import { Component, createElement } from "react";

import TagManager from "react-gtm-module";

export class GTMContainer extends Component {
    init = false;
    prevDataLayer = null;

    componentDidMount() {
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

    createData = () => {
        let dataLayer = '{"event":"' + this.props.pageViewEventName + '",';

        if (this.props.sendPageTitle) {
            dataLayer += '"Page Name":"' + mx.ui.getContentForm().title + '",';
        }

        if (this.props.sendModuleLocation) {
            const modulePath = mx.ui.getContentForm().path;
            // eslint-disable-next-line
            const moduleLocation = function (modPath) {
                const pageExtension = ".page.xml";
                const path = modPath.substr(0, modPath.length - pageExtension.length);
                return path;
            };
            dataLayer += '"Module Location":"' + moduleLocation(modulePath) + '",';
        }

        if (this.props.sendPageURL) {
            let pageURL;
            if (mx.ui.getContentForm().url !== null) {
                pageURL = window.location.origin + mx.ui.getContentForm().url;
            } else {
                pageURL = window.location.origin;
            }

            // eslint-disable-next-line
            const trimmedURL = function (fullURL) {
                const lastCharIndex = fullURL.lastIndexOf("/");
                const endString = fullURL.substring(lastCharIndex + 1, fullURL.length);
                if (isNaN(endString)) {
                    return fullURL; // the end of the string isn't a number, return the whole thing
                } else {
                    return fullURL.substr(0, lastCharIndex); // the end of the string is a number, trim it
                }
            };
            dataLayer += '"Page URL":"' + trimmedURL(pageURL) + '",';
        }

        if (this.props.sendSessionID) {
            dataLayer += '"Session ID":"' + mx.session.getSessionObjectId() + '",';
        }

        if (this.props.sendAdditionalProps) {
            let expressionResult = "";
            for (const object of this.props.additionalProps) {
                expressionResult += (object.propValue.value || "") + ", ";
                expressionResult = expressionResult.replace(/,\s*$/, "");
                dataLayer += '"' + object.propName + '":"' + expressionResult + '",';
                expressionResult = "";
            }
        }

        dataLayer = dataLayer.replace(/,\s*$/, ""); // remove the last comma from the dataLayer variable
        dataLayer += "}";
        return JSON.parse(dataLayer);
    };

    pushData = () => {
        const dataAvailable = this.checkDataAvailability();
        if (dataAvailable) {
            const dataLayer = this.createData();
            if (JSON.stringify(this.prevDataLayer) !== JSON.stringify(dataLayer)) {
                this.prevDataLayer = dataLayer; // Update prevDataLayer to the latest
                TagManager.dataLayer({ dataLayer });
            }
        }
    };

    render() {
        return null;
    }
}
