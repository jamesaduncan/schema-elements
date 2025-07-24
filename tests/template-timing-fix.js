// Example of robust template handling to avoid timing issues

import { Microdata } from "https://jamesaduncan.github.io/schema-elements/index.mjs";

// Helper function to safely get template with retry
async function getTemplate(selector, maxRetries = 10, delay = 100) {
    for (let i = 0; i < maxRetries; i++) {
        const template = document.querySelector(selector);
        if (template instanceof HTMLTemplateElement) {
            return template;
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error(`Template not found: ${selector}`);
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const userData = await Microdata.fetch('/auth/user');
        
        // Use the helper to get templates safely
        {
            const template = new Microdata.Template(await getTemplate('nav > template'));
            const result = template.render(userData.microdata[0]);
            document.querySelector('nav').appendChild(result);
        }
        
        {
            const template = new Microdata.Template(await getTemplate('#new-todo template'));
            const result = template.render(userData.microdata[0]);
            document.querySelector('#new-todo').appendChild(result);
        }
        
        const form = document.querySelector('form#new-todo');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const template = new Microdata.Template(await getTemplate('#todos template'));
            document.querySelector('#todos').POST(template.render(form));
            form.reset();
        });
        
    } catch (error) {
        console.error('Template initialization error:', error);
    }
});

// Alternative: Wait for window.load which ensures everything is fully loaded
window.addEventListener("load", async () => {
    // Your code here - templates will definitely be available
});

// Alternative 2: Check if templates exist before using them
document.addEventListener("DOMContentLoaded", async () => {
    const userData = await Microdata.fetch('/auth/user');
    
    // Check and wait for templates if needed
    const navTemplate = document.querySelector('nav > template');
    if (!navTemplate) {
        console.warn('Nav template not found, waiting...');
        // You could implement a retry mechanism here
        return;
    }
    
    const template = new Microdata.Template(navTemplate);
    const result = template.render(userData.microdata[0]);
    document.querySelector('nav').appendChild(result);
});