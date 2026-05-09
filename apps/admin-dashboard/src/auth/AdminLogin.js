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
exports.default = AdminLogin;
var react_1 = require("react");
require("./AdminLogin.css");
function AdminLogin(_a) {
    var _this = this;
    var onSignIn = _a.onSignIn, _b = _a.initialIdentifier, initialIdentifier = _b === void 0 ? "" : _b, _c = _a.initialRememberMe, initialRememberMe = _c === void 0 ? false : _c, _d = _a.initialErrorMessage, initialErrorMessage = _d === void 0 ? null : _d;
    var _e = (0, react_1.useState)(initialIdentifier), identifier = _e[0], setIdentifier = _e[1];
    var _f = (0, react_1.useState)(""), password = _f[0], setPassword = _f[1];
    var _g = (0, react_1.useState)(false), showPassword = _g[0], setShowPassword = _g[1];
    var _h = (0, react_1.useState)(initialRememberMe), rememberMe = _h[0], setRememberMe = _h[1];
    var _j = (0, react_1.useState)(initialErrorMessage), errorMessage = _j[0], setErrorMessage = _j[1];
    var _k = (0, react_1.useState)(false), isSubmitting = _k[0], setIsSubmitting = _k[1];
    (0, react_1.useEffect)(function () {
        setErrorMessage(initialErrorMessage);
    }, [initialErrorMessage]);
    var handleSubmit = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    if (isSubmitting)
                        return [2 /*return*/];
                    setIsSubmitting(true);
                    setErrorMessage(null);
                    return [4 /*yield*/, onSignIn(identifier.trim(), password, rememberMe)];
                case 1:
                    error = _a.sent();
                    if (error)
                        setErrorMessage(error);
                    setIsSubmitting(false);
                    return [2 /*return*/];
            }
        });
    }); };
    return (<main className="login-page">
      <section className="login-shell">
        <div className="login-shell__brand" aria-hidden="true">
          <div className="brand-block">
            <img src="/triketrack_logo.png" alt="TrikeTrack logo" className="brand-logo"/>
            <h1 className="brand-title">
              <span className="brand-title--blue">TRIKE</span>
              <span className="brand-title--green">TRACK</span>
            </h1>
            <p className="brand-subtitle">TODA Route Monitoring System</p>
          </div>
        </div>

        <div className="login-shell__form-wrap">
          <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
            <h2>Welcome, admin.</h2>
            <p className="login-form__lead">
              Please login to access TrikeTrack dashboard.
            </p>

            <label htmlFor="identifier">E-mail</label>
            <div className="input-wrap">
              <span className="input-wrap__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 12.2a3.1 3.1 0 1 0 0-6.2a3.1 3.1 0 0 0 0 6.2Z"/>
                  <path d="M4.7 19.2c.7-2.8 3-4.2 7.3-4.2c4.2 0 6.5 1.4 7.3 4.2H4.7Z"/>
                </svg>
              </span>
              <input id="identifier" type="text" value={identifier} onChange={function (event) { return setIdentifier(event.target.value); }} placeholder="Enter your email" autoComplete="off" required/>
            </div>

            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <span className="input-wrap__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M17.5 10H17V7.8C17 5 14.8 3 12 3S7 5 7 7.8V10h-.5A1.5 1.5 0 0 0 5 11.5v7A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 17.5 10ZM9 7.8C9 6.1 10.3 5 12 5s3 1.1 3 2.8V10H9V7.8Z"/>
                </svg>
              </span>
              <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={function (event) { return setPassword(event.target.value); }} placeholder="Enter your password" autoComplete="off" required/>
              <button type="button" className="input-wrap__toggle" onClick={function () { return setShowPassword(function (current) { return !current; }); }} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                {showPassword ? (<svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 7c-4.9 0-8.9 4.5-9 4.7L2.5 12l.5.3C3.1 12.5 7.1 17 12 17s8.9-4.5 9-4.7l.5-.3l-.5-.3C20.9 11.5 16.9 7 12 7Zm0 8a3 3 0 1 1 0-6a3 3 0 0 1 0 6Z"/>
                  </svg>) : (<svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 7c-4.9 0-8.9 4.5-9 4.7L2.5 12l.5.3C3.1 12.5 7.1 17 12 17c1.5 0 2.9-.4 4.1-1.1l-1.5-1.5a3 3 0 0 1-4.1-4.1L9 8.8c.9-.5 1.9-.8 3-.8c3.3 0 5.8 2.5 6.6 3.4c-.4.6-1.3 1.5-2.5 2.3l1.4 1.4c2-1.3 3.2-2.8 3.3-2.9l.5-.3l-.5-.3C20.9 11.5 16.9 7 12 7Z"/>
                    <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>)}
              </button>
            </div>

            <div className="login-meta-row">
              <label className="remember-me">
                <input type="checkbox" name="rememberMe" checked={rememberMe} onChange={function (event) { return setRememberMe(event.target.checked); }}/>
                <span>Remember Me</span>
              </label>
              <a className="forgot-link" href="#" onClick={function (event) { return event.preventDefault(); }}>
                Forgot Password?
              </a>
            </div>

            {errorMessage ? <div className="login-error">{errorMessage}</div> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>
      </section>
    </main>);
}
