// =====================================================================
// CTF Ultimate Auto-Winner (Anti-Tails / Anti-Negative)
// Paste into browser console (F12 -> Console)
// =====================================================================

(function() {
    'use strict';
    console.log("%c[+] ULTIMATE AUTO-WINNER LOADED: 100% Win Rate Activated", "color: lime; font-weight: bold; font-size: 16px; background: black; padding: 4px;");

    const TARGET_BET = 1000; 
    const WIN_AMOUNT = TARGET_BET * 2; // We add 2000 to negate the loss and apply the win

    // Helper function to fix text (handles "tails", "thumbs-down", and "Balance")
    function fixText(text) {
        if (!text) return text;
        
        // 1. Change "tails" to "heads" and "loss" to "win" (case insensitive)
        let newText = text.replace(/tails/gi, 'heads')
                          .replace(/\bloss\b/gi, 'win')
                          .replace(/fa-thumbs-down/gi, 'fa-thumbs-up')
                          .replace(/text-danger/gi, 'text-success')
                          .replace(/text-red/gi, 'text-green');

        // 2. Fix the balance. Match "Balance: β1234" or "Balance: 1234"
        // We look for the Greek Beta (β) OR just the word Balance
        newText = newText.replace(/(Balance:?\s*[βb]?)(\d+)/gi, function(match, prefix, balanceStr) {
            let oldBalance = parseInt(balanceStr, 10);
            let newBalance = oldBalance + WIN_AMOUNT;
            // Preserve the beta symbol if it was there
            let symbol = prefix.includes('β') ? 'β' : (prefix.includes('b') ? 'b' : '');
            return `Balance: ${symbol}${newBalance}`;
        });

        return newText;
    }

    // --- LAYER 1: Intercept Fetch (hfnotify.php) ---
    const originalFetch = window.fetch;
    window.fetch = async function(resource, init) {
        // Force outgoing bet to 1000 if we are sending a flip command via fetch
        if (init && init.body && typeof init.body === 'string' && init.body.includes('/flip')) {
            init.body = init.body.replace(/\/flip\s+-?\d+/, `/flip ${TARGET_BET}`);
            console.log("%c[!] Outgoing Fetch Bet forced to 1000", "color: orange;");
        }

        const response = await originalFetch.apply(this, arguments);
        const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');

        if (url.includes('hfnotify.php')) {
            try {
                const clone = response.clone();
                const text = await clone.text();

                if (text.toLowerCase().includes('tails') || text.toLowerCase().includes('thumbs-down')) {
                    console.log("%c[!] Intercepted Loss in Fetch API. Forcing Win...", "color: orange; font-weight: bold;");
                    const newText = fixText(text);
                    
                    return new Response(newText, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
            } catch (e) {
                // Ignore errors
            }
        }
        return response;
    };

    // --- LAYER 2: Intercept WebSockets ---
    // Force outgoing bet
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
        try {
            if (typeof data === 'string' && data.includes('/flip')) {
                data = data.replace(/\/flip\s+-?\d+/, `/flip ${TARGET_BET}`);
                console.log("%c[!] Outgoing WebSocket Bet forced to 1000", "color: orange;");
            }
        } catch(e) {}
        return originalSend.apply(this, [data]);
    };

    // Intercept incoming WebSocket messages
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
        const ws = new OriginalWebSocket(...args);
        
        ws.addEventListener('message', function(event) {
            try {
                if (typeof event.data === 'string') {
                    if (event.data.toLowerCase().includes('tails') || event.data.toLowerCase().includes('thumbs-down')) {
                        console.log("%c[!] Intercepted Loss in WebSocket. Forcing Win...", "color: orange; font-weight: bold;");
                        
                        const newData = fixText(event.data);
                        
                        event.stopImmediatePropagation();
                        const modifiedEvent = new MessageEvent('message', {
                            data: newData,
                            origin: event.origin,
                            lastEventId: event.lastEventId,
                            source: event.source,
                            ports: event.ports
                        });
                        ws.dispatchEvent(modifiedEvent);
                    }
                }
            } catch (e) {}
        }, true); // Use capture phase to intercept before app logic

        return ws;
    };
    Object.assign(window.WebSocket, OriginalWebSocket);

    // --- LAYER 3: Visual Fallback (MutationObserver) ---
    // If the app manages to render a loss, this instantly rewrites the HTML in the chat box.
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    // Check if the new node has the losing text or icons
                    if (node.nodeType === 1 && (node.innerHTML.includes('Result: tails') || node.innerHTML.includes('fa-thumbs-down'))) {
                        
                        // Fix the HTML directly
                        let newHtml = fixText(node.innerHTML);
                        node.innerHTML = newHtml;
                        
                        console.log("%c[!] DOM Fallback Triggered: Changed visual loss to win.", "color: cyan;");
                    }
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log("Layers 1, 2, and 3 initialized. Type /flip 1000 to test.");
})();
