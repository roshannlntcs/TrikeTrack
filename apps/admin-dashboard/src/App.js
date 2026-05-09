"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var AdminLogin_1 = require("./auth/AdminLogin");
var AdminShell_1 = require("./layout/AdminShell");
var admin_profile_1 = require("./lib/admin-profile");
var network_errors_1 = require("./lib/network-errors");
var supabase_1 = require("./lib/supabase");
var ADMIN_REMEMBERED_EMAIL_KEY = "triketrack_admin_remembered_email";
function App() {
    var _this = this;
    var _a = (0, react_1.useState)(null), session = _a[0], setSession = _a[1];
    var _b = (0, react_1.useState)(false), authReady = _b[0], setAuthReady = _b[1];
    var _c = (0, react_1.useState)(null), adminProfile = _c[0], setAdminProfile = _c[1];
    var _d = (0, react_1.useState)(null), authError = _d[0], setAuthError = _d[1];
    var _e = (0, react_1.useState)(function () {
        var _a;
        return (_a = window.localStorage.getItem(ADMIN_REMEMBERED_EMAIL_KEY)) !== null && _a !== void 0 ? _a : "";
    }), rememberedEmail = _e[0], setRememberedEmail = _e[1];
    var _f = (0, react_1.useState)(function () {
        var _a;
        return ((_a = window.localStorage.getItem(ADMIN_REMEMBERED_EMAIL_KEY)) !== null && _a !== void 0 ? _a : "").length > 0;
    }), defaultRememberMe = _f[0], setDefaultRememberMe = _f[1];
    (0, react_1.useEffect)(function () {
        var active = true;
        void supabase_1.supabase.auth.getSession().then(function (_a) {
            var data = _a.data;
            if (!active)
                return;
            setSession(data.session);
            setAuthReady(true);
        });
        var subscription = supabase_1.supabase.auth.onAuthStateChange(function (_event, nextSession) {
            if (!active)
                return;
            setSession(nextSession);
            setAuthReady(true);
            if (!nextSession) {
                setAdminProfile(null);
            }
        }).data.subscription;
        return function () {
            active = false;
            subscription.unsubscribe();
        };
    }, []);
    (0, react_1.useEffect)(function () {
        var active = true;
        var loadProfile = function () { return __awaiter(_this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(session === null || session === void 0 ? void 0 : session.access_token)) {
                            setAdminProfile(null);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, (0, admin_profile_1.fetchAdminProfile)(session.access_token)];
                    case 1:
                        result = _a.sent();
                        if (!active)
                            return [2 /*return*/];
                        if (!result.error) return [3 /*break*/, 3];
                        setAuthError(result.error);
                        setAdminProfile(null);
                        return [4 /*yield*/, supabase_1.supabase.auth.signOut()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                    case 3:
                        setAuthError(null);
                        setAdminProfile(result.profile);
                        return [2 /*return*/];
                }
            });
        }); };
        void loadProfile();
        return function () {
            active = false;
        };
    }, [session]);
    var handleSignIn = function (identifier, password, rememberMe) { return __awaiter(_this, void 0, void 0, function () {
        var _a, data, error, profileResult, error_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!identifier || !password)
                        return [2 /*return*/, "Please enter email and password."];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, supabase_1.supabase.auth.signInWithPassword({
                            email: identifier,
                            password: password
                        })];
                case 2:
                    _a = _c.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        if (error.message.toLowerCase().includes("invalid login credentials")) {
                            return [2 /*return*/, "incorrect email or password, please try again"];
                        }
                        return [2 /*return*/, (0, network_errors_1.toSupabaseAuthErrorMessage)(error)];
                    }
                    if (!((_b = data.session) === null || _b === void 0 ? void 0 : _b.access_token)) {
                        return [2 /*return*/, "Login did not return a valid session."];
                    }
                    return [4 /*yield*/, (0, admin_profile_1.fetchAdminProfile)(data.session.access_token)];
                case 3:
                    profileResult = _c.sent();
                    if (!profileResult.error) return [3 /*break*/, 5];
                    return [4 /*yield*/, supabase_1.supabase.auth.signOut()];
                case 4:
                    _c.sent();
                    return [2 /*return*/, profileResult.error];
                case 5:
                    if (rememberMe) {
                        window.localStorage.setItem(ADMIN_REMEMBERED_EMAIL_KEY, identifier);
                        setRememberedEmail(identifier);
                        setDefaultRememberMe(true);
                    }
                    else {
                        window.localStorage.removeItem(ADMIN_REMEMBERED_EMAIL_KEY);
                        setRememberedEmail("");
                        setDefaultRememberMe(false);
                    }
                    setAuthError(null);
                    setAdminProfile(profileResult.profile);
                    return [2 /*return*/, null];
                case 6:
                    error_1 = _c.sent();
                    return [2 /*return*/, (0, network_errors_1.toSupabaseAuthErrorMessage)(error_1)];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleLogout = function () {
        setAuthError(null);
        setAdminProfile(null);
        void supabase_1.supabase.auth.signOut();
    };
    if (!authReady) {
        return null;
    }
    if (!session || !adminProfile) {
        return (<AdminLogin_1.default onSignIn={handleSignIn} initialIdentifier={rememberedEmail} initialRememberMe={defaultRememberMe} initialErrorMessage={authError}/>);
    }
    return (<AdminShell_1.default onLogout={handleLogout} adminProfile={adminProfile} accessToken={session.access_token}/>);
}
