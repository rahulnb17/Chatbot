// utils/helpers.js
function sanitizeInput(input) {
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

module.exports = { sanitizeInput };
