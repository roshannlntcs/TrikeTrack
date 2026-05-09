"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAdminApiErrorMessage = exports.toSupabaseAuthErrorMessage = void 0;
var getErrorMessage = function (error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
};
var isNetworkFetchError = function (message) {
    return /failed to fetch|networkerror|load failed/i.test(message);
};
var toSupabaseAuthErrorMessage = function (error) {
    var message = getErrorMessage(error);
    if (isNetworkFetchError(message)) {
        return "Unable to reach Supabase right now. Check your internet connection and the admin dashboard Supabase settings.";
    }
    return message;
};
exports.toSupabaseAuthErrorMessage = toSupabaseAuthErrorMessage;
var toAdminApiErrorMessage = function (error) {
    var message = getErrorMessage(error);
    if (isNetworkFetchError(message)) {
        if (import.meta.env.DEV) {
            return "Unable to reach the admin API. Make sure the backend server is running on port 4000.";
        }
        return "Unable to reach the admin API. Check that the backend service is online.";
    }
    return message;
};
exports.toAdminApiErrorMessage = toAdminApiErrorMessage;
