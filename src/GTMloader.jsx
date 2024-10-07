import { Component, createElement } from "react";

import { GTMContainer } from "./components/GTMContainer";

export class GTMloader extends Component {
    render() {
        return (
            <GTMContainer
                gtmCodes={this.props.gtmCodes}
                sendCustomProps={this.props.sendCustomProps}
                pageViewEventName={this.props.pageViewEventName}
                sendPageTitle={this.props.sendPageTitle}
                sendModuleLocation={this.props.sendModuleLocation}
                sendPageURL={this.props.sendPageURL}
                sendSessionID={this.props.sendSessionID}
                sendAdditionalProps={this.props.sendAdditionalProps}
                additionalProps={this.props.additionalProps}
            />
        );
    }
}
