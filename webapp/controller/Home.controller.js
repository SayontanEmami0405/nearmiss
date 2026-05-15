sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
],
    function (Controller,BusyIndicator,MessageBox,Filter,FilterOperator) {
        "use strict";

        return Controller.extend("com.emami.nearmiss.controller.Home", {
            onInit: function () {
                
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RouteHome").attachPatternMatched(this._onObjectMatched, this);
            },

            _onObjectMatched: function (oEvent) {
                let that = this;
                debugger;
                const oModel = this.getView().getModel();
                const oRouter = sap.ui.core.UIComponent.getRouterFor(that);
                oRouter.navTo("RouteInitiator"); 
                // BusyIndicator.show();
                // oModel.read("/ZUSERINFOSet('')", {
                //     success: function (oSuccess) {
                //         BusyIndicator.hide();
                //         debugger;
                //         // oSuccess.Type = "U";
                //         const oRouter = sap.ui.core.UIComponent.getRouterFor(that);
                //         // console.log(oRouter.getRoutes());
                //         if(oSuccess?.Type === "I"){
                //             oRouter.navTo("RouteInitiator");
                //         }else if (oSuccess?.Type === "R"){
                //             oRouter.navTo("RouteReviewer");
                //         }else if (oSuccess?.Type === "A"){
                //             oRouter.navTo("RouteApprover");
                //         }else if (oSuccess?.Type === "U"){
                //             oRouter.navTo("RouteUser");
                //         }else {
                //             sap.m.MessageToast.show("Not a valid user.");
                //         }
                        
                //     },
                //     error: function (oError) {
                //         console.log(oError);
                //         BusyIndicator.hide();
                //         sap.m.MessageToast.show("Failed to load user detail.");
                //     }
                // });
            }
        });
    });
