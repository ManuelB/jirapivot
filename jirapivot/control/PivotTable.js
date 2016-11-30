/*!
 * ${copyright}
 */

// Provides control jirapivot.control.PivotTable
sap.ui.define(['jquery.sap.global', 'sap/ui/core/Control'],
    function(jQuery, Control) {
        "use strict";

        /**
         * Constructor for a new PivotTable.
         *
         * @param {string} [sId] ID for the new control, generated automatically if no ID is given
         * @param {object} [mSettings] Initial settings for the new control
         *
         * @class
         * The PivotTable control is used in a UI5 application to provide PivotTable.
         * @extends sap.ui.core.Control
         *
         * @author Incentergy GmbH
         * @version ${version}
         *
         * @constructor
         * @public
         * @alias jirapivot.control.PivotTable
         * @ui5-metamodel This control/element also will be described in the UI5 (legacy) designtime metamodel
         */
        var PivotTable = Control.extend("jirapivot.control.PivotTable", /** @lends jirapivot.control.PivotTable.prototype */ {
            metadata: {
                library: "jirapivot.control",
                properties: {
                    data: {
                        type: "Array",
                        group: "Data",
                        defaultValue: []
                    }
                }
            },
            renderer: function(oRM, oControl) {
                oRM.write("<div");
                oRM.writeControlData(oControl);
                oRM.writeClasses();
                oRM.write(">");
                oRM.write("</div>");
            }
        });

        PivotTable.prototype.onAfterRendering = function() {
            jQuery("#" + this.getId()).pivotUI(this.getData(), {
                rendererName: "Heatmap"
            });
        };

        return PivotTable;

    }, /* bExport= */ true);