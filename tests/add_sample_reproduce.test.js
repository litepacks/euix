import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';
import fs from 'fs';
import path from 'path';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('Add Employee and Add Holding Verification Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('should test Add Holding in CryptoPortfolioSection', () => {
        const cryptoXml = fs.readFileSync(path.resolve(__dirname, '../components/CryptoPortfolioSection.xml'), 'utf-8');
        const xml = `
        <uid_spec>
            <data_model>
                <state id="btc_price">64612.00</state>
                <state id="eth_price">1905.40</state>
                <state id="sol_price">73.20</state>
                <state id="new_symbol">BTC</state>
                <state id="new_amount">0.5</state>
                <state id="new_buy_price">62000</state>
                <state id="portfolio" type="array">
                    <item symbol="BTC" amount="0.25" buy_price="60000" />
                </state>
                <state id="code_modal_open">false</state>
                <state id="code_modal_title"></state>
                <state id="code_modal_lines"></state>
                <state id="code_modal_content"></state>
                <state id="clear_modal_open">false</state>
            </data_model>
            <container>
                ${cryptoXml}
                <crypto-portfolio-section />
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('portfolio').length).toBe(1);

        const buttons = Array.from(container.querySelectorAll('button'));
        const addHoldingBtn = buttons.find(b => b.textContent.includes('Add Holding'));
        expect(addHoldingBtn).toBeDefined();

        addHoldingBtn.click();

        expect(engine.getState('portfolio').length).toBe(2);
    });

    it('should test Add Employee in TableSection', () => {
        const tableXml = fs.readFileSync(path.resolve(__dirname, '../components/TableSection.xml'), 'utf-8');
        const xml = `
        <uid_spec>
            <data_model>
                <state id="table_open">true</state>
                <state id="new_emp_name"></state>
                <state id="new_emp_role"></state>
                <state id="new_emp_dept"></state>
                <state id="employees" type="array">
                    <item name="Ahmet Yilmaz" role="Lead Architect" dept="Core Engine" status="Active" />
                </state>
                <state id="code_modal_open">false</state>
                <state id="code_modal_title"></state>
                <state id="code_modal_lines"></state>
                <state id="code_modal_content"></state>
            </data_model>
            <container>
                ${tableXml}
                <table-section />
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('employees').length).toBe(1);

        // Type into inputs
        const nameInput = container.querySelector('input[placeholder="Employee Name"]');
        const roleInput = container.querySelector('input[placeholder*="Role"]');
        const deptInput = container.querySelector('input[placeholder*="Dept"]');

        expect(nameInput).toBeDefined();
        nameInput.value = 'Elif Yildiz';
        nameInput.dispatchEvent(new window.Event('input'));

        roleInput.value = 'Security Lead';
        roleInput.dispatchEvent(new window.Event('input'));

        deptInput.value = 'SecOps';
        deptInput.dispatchEvent(new window.Event('input'));

        const buttons = Array.from(container.querySelectorAll('button'));
        const addEmpBtn = buttons.find(b => b.textContent.includes('Add Employee'));
        expect(addEmpBtn).toBeDefined();

        addEmpBtn.click();

        expect(engine.getState('employees').length).toBe(2);
    });
});
