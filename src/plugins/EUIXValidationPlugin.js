/**
 * src/plugins/EUIXValidationPlugin.js
 * Declarative Form Validation Schema & Reactive Error Engine for EUIX Engine.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

export const EUIXValidationPlugin = {
    name: "validation",
    install(engineClass) {
        const proto = engineClass.prototype;

        proto._initValidationEngine = function () {
            if (!this._validationRules) {
                this._validationRules = new Map();
                this._formErrors = {};
                this._isFormValid = true;
            }
            if (this._validationRules.size === 0 && this.xmlDoc && !this._isParsingValidationRules) {
                this._isParsingValidationRules = true;
                this._parseValidationRulesFromDoc(this.xmlDoc);
                this._isParsingValidationRules = false;
            }
        };

        /**
         * Registers validation rules for a specific field.
         * @param {string} fieldId
         * @param {object} rules
         */
        proto.registerValidationRule = function (fieldId, rules = {}) {
            this._initValidationEngine();
            const cleanKey = this.parseBindPath(fieldId);
            this._validationRules.set(cleanKey, { ...rules });
            return this;
        };

        /**
         * Validates a single field against its registered rules.
         * @param {string} fieldId
         * @returns {string|null} Error message or null if valid
         */
        proto.validateField = function (fieldId) {
            this._initValidationEngine();
            const cleanKey = this.parseBindPath(fieldId);
            const rules = this._validationRules.get(cleanKey);
            if (!rules) return null;

            const val = this.getState(cleanKey);
            const strVal = val !== undefined && val !== null ? String(val).trim() : "";
            let errorMsg = null;

            // 1. Required rule
            if (rules.required && !strVal) {
                errorMsg = rules.requiredMsg || rules.message || `${cleanKey} is required`;
            }

            // 2. Email rule
            if (!errorMsg && strVal && rules.email) {
                if (!EMAIL_REGEX.test(strVal)) {
                    errorMsg = rules.emailMsg || rules.message || "Invalid email format";
                }
            }

            // 3. Min Length rule
            if (!errorMsg && strVal && rules.minLength != null && rules.minLength !== "") {
                const min = parseInt(rules.minLength, 10);
                if (!Number.isNaN(min) && strVal.length < min) {
                    errorMsg = rules.minLengthMsg || rules.message || `Minimum ${min} characters required`;
                }
            }

            // 4. Max Length rule
            if (!errorMsg && strVal && rules.maxLength != null && rules.maxLength !== "") {
                const max = parseInt(rules.maxLength, 10);
                if (!Number.isNaN(max) && strVal.length > max) {
                    errorMsg = rules.maxLengthMsg || rules.message || `Maximum ${max} characters allowed`;
                }
            }

            // 5. Min/Max Numeric Value rules
            if (
                !errorMsg &&
                strVal &&
                ((rules.min != null && rules.min !== "") || (rules.max != null && rules.max !== ""))
            ) {
                const num = parseFloat(strVal);
                if (Number.isNaN(num)) {
                    errorMsg = rules.message || "Must be a valid number";
                } else if (rules.min != null && rules.min !== "" && num < parseFloat(rules.min)) {
                    errorMsg = rules.minMsg || rules.message || `Minimum value is ${rules.min}`;
                } else if (rules.max != null && rules.max !== "" && num > parseFloat(rules.max)) {
                    errorMsg = rules.maxMsg || rules.message || `Maximum value is ${rules.max}`;
                }
            }

            // 6. Pattern Regex rule
            if (!errorMsg && strVal && rules.pattern) {
                try {
                    const regex = new RegExp(rules.pattern);
                    if (!regex.test(strVal)) {
                        errorMsg = rules.patternMsg || rules.message || "Invalid format";
                    }
                } catch (_) {}
            }

            // 7. URL rule
            if (!errorMsg && strVal && rules.url) {
                if (!URL_REGEX.test(strVal)) {
                    errorMsg = rules.urlMsg || rules.message || "Invalid URL format";
                }
            }

            // 8. Match other field rule (e.g. confirm_password === password)
            if (!errorMsg && rules.match) {
                const otherKey = this.parseBindPath(rules.match);
                const otherVal = this.getState(otherKey);
                if (val !== otherVal) {
                    errorMsg = rules.matchMsg || rules.message || `Must match ${rules.match}`;
                }
            }

            // 9. Custom validation function
            if (!errorMsg && typeof rules.custom === "function") {
                const customResult = rules.custom(val, this.state || this._rawState, this);
                if (customResult && typeof customResult === "string") {
                    errorMsg = customResult;
                } else if (customResult === false) {
                    errorMsg = rules.message || "Validation failed";
                }
            }

            this.setFieldError(cleanKey, errorMsg);
            return errorMsg;
        };

        /**
         * Validates all registered fields in the form.
         * @returns {{ isValid: boolean, errors: Record<string, string> }}
         */
        proto.validateForm = function () {
            this._initValidationEngine();
            const errors = {};
            let isValid = true;

            for (const fieldKey of this._validationRules.keys()) {
                const err = this.validateField(fieldKey);
                if (err) {
                    errors[fieldKey] = err;
                    isValid = false;
                }
            }

            this._isFormValid = isValid;
            this._formErrors = errors;

            if (this._rawState) {
                this._rawState.errors = { ...errors };
                this._rawState.$errors = { ...errors };
                this._rawState.$isValid = isValid;
            }

            this.syncBindings("$isValid", isValid);
            this.syncBindings("errors", { ...errors });
            this.syncBindings("$errors", { ...errors });

            return { isValid, errors };
        };

        /**
         * Sets an individual field's validation error message.
         * @param {string} fieldId
         * @param {string|null} errorMsg
         */
        proto.setFieldError = function (fieldId, errorMsg) {
            this._initValidationEngine();
            const cleanKey = this.parseBindPath(fieldId);
            if (errorMsg) {
                this._formErrors[cleanKey] = errorMsg;
            } else {
                delete this._formErrors[cleanKey];
            }

            this._isFormValid = Object.keys(this._formErrors).length === 0;

            if (this._rawState) {
                this._rawState.errors = { ...this._formErrors };
                this._rawState.$errors = { ...this._formErrors };
                this._rawState.$isValid = this._isFormValid;
            }

            this.syncBindings(`errors.${cleanKey}`, errorMsg || "");
            this.syncBindings(`$errors.${cleanKey}`, errorMsg || "");
            this.syncBindings(`errors:${cleanKey}`, errorMsg || "");
            this.syncBindings("errors", { ...this._formErrors });
            this.syncBindings("$errors", { ...this._formErrors });
            this.syncBindings("$isValid", this._isFormValid);
        };

        /**
         * Resets all validation errors and restores form valid state.
         */
        proto.resetValidation = function () {
            this._initValidationEngine();
            this._formErrors = {};
            this._isFormValid = true;

            if (this._rawState) {
                this._rawState.errors = {};
                this._rawState.$errors = {};
                this._rawState.$isValid = true;
            }

            this.syncBindings("errors", {});
            this.syncBindings("$errors", {});
            this.syncBindings("$isValid", true);
            for (const fieldKey of this._validationRules.keys()) {
                this.syncBindings(`errors.${fieldKey}`, "");
                this.syncBindings(`$errors.${fieldKey}`, "");
            }
        };

        // Extract declarative <validation_rules> and <form_rules> from XML Document
        proto._parseValidationRulesFromDoc = function (doc) {
            if (!doc || typeof doc.getElementsByTagName !== "function") return;
            const tags = ["validation_rules", "form_rules", "validation"];
            tags.forEach((t) => {
                const rNodes = doc.getElementsByTagName(t);
                for (let i = 0; i < rNodes.length; i++) {
                    const rNode = rNodes[i];
                    const fTags = ["field", "rule"];
                    fTags.forEach((ft) => {
                        const fields = rNode.getElementsByTagName(ft);
                        for (let j = 0; j < fields.length; j++) {
                            const field = fields[j];
                            const id =
                                field.getAttribute("id") ||
                                field.getAttribute("name") ||
                                field.getAttribute("field") ||
                                field.getAttribute("bind");
                            if (id) {
                                this.registerValidationRule(id, {
                                    required: field.getAttribute("required") === "true",
                                    requiredMsg: field.getAttribute("required_msg"),
                                    email:
                                        field.getAttribute("email") === "true" ||
                                        field.getAttribute("type") === "email",
                                    emailMsg: field.getAttribute("email_msg"),
                                    url:
                                        field.getAttribute("url") === "true" ||
                                        field.getAttribute("type") === "url",
                                    urlMsg: field.getAttribute("url_msg"),
                                    minLength: field.getAttribute("min_length") || field.getAttribute("minlength"),
                                    minLengthMsg: field.getAttribute("min_length_msg"),
                                    maxLength: field.getAttribute("max_length") || field.getAttribute("maxlength"),
                                    maxLengthMsg: field.getAttribute("max_length_msg"),
                                    min: field.getAttribute("min"),
                                    minMsg: field.getAttribute("min_msg"),
                                    max: field.getAttribute("max"),
                                    maxMsg: field.getAttribute("max_msg"),
                                    pattern: field.getAttribute("pattern"),
                                    patternMsg: field.getAttribute("pattern_msg"),
                                    match: field.getAttribute("match") || field.getAttribute("equals"),
                                    matchMsg: field.getAttribute("match_msg"),
                                    message:
                                        field.getAttribute("message") ||
                                        field.getAttribute("msg") ||
                                        field.textContent?.trim() ||
                                        "",
                                });
                            }
                        }
                    });
                }
            });
        };

        // Register Declarative Action Handlers
        engineClass.registerAction("VALIDATE_FORM", async function (actionNode, context) {
            const res = this.validateForm();
            if (!res.isValid) {
                const onErrorAction = actionNode?.getAttribute("on_error");
                if (onErrorAction) {
                    await this.executeAction(onErrorAction, context);
                }
                return false;
            }
            const onSuccessAction = actionNode?.getAttribute("on_success");
            if (onSuccessAction) {
                return this.executeAction(onSuccessAction, context);
            }
            return true;
        });

        engineClass.registerAction("VALIDATE_FIELD", function (actionNode, context) {
            const field =
                (actionNode?.getAttribute && actionNode.getAttribute("field")) ||
                (this.getChild && this.getChild(actionNode, "field")?.textContent?.trim()) ||
                context?.field ||
                "";
            if (field) {
                return this.validateField(field);
            }
            return null;
        });

        engineClass.registerAction("RESET_VALIDATION", function () {
            this.resetValidation();
        });
        engineClass.registerAction("CLEAR_ERRORS", function () {
            this.resetValidation();
        });
    }
};
