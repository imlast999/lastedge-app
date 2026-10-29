"""
Test suite validating the LastEdge Institutional Ecosystem Onboarding Wizard & Modular Configuration.
Enforces:
1. First-run modal presence and wording.
2. Invariant requirement: Minimum 1 of the 2 modules (Trading Engine, Strategy Lab) MUST be active.
3. Cross-version persistence keys and adaptive modular UI controls.
"""
from pathlib import Path
import re


def test_web_dashboard_ecosystem_elements():
    dash_dir = Path(r"C:\LastEdge\LastEdge App\dashboard")
    index_html = (dash_dir / "index.html").read_text(encoding="utf-8")
    style_css = (dash_dir / "style.css").read_text(encoding="utf-8")
    script_js = (dash_dir / "script.js").read_text(encoding="utf-8")

    # 1. HTML Modals and Groups
    assert 'id="ecosystem-onboarding-modal"' in index_html
    assert 'id="ecosystem-settings-modal"' in index_html
    assert 'id="nav-group-core"' in index_html
    assert 'id="nav-group-research"' in index_html
    assert "Esta app es parte del ecosistema" in index_html
    assert "¿Qué partes del ecosistema tienes activas?" in index_html
    assert "Trading Engine" in index_html
    assert "Strategy Lab" in index_html
    assert "Debes seleccionar como mínimo 1 servicio del ecosistema" in index_html

    # 2. CSS Rules
    assert ".ecosystem-modal-backdrop" in style_css
    assert ".ecosystem-dialog" in style_css
    assert ".ecosystem-card" in style_css
    assert ".ecosystem-card.selected" in style_css

    # 3. JavaScript Logic & Invariants
    assert "lastedge_ecosystem_modules" in script_js
    assert "initEcosystemModules" in script_js
    assert "saveEcosystemModulesToStorage" in script_js
    assert "applyEcosystemModules" in script_js
    assert "toggleWizardModule" in script_js
    assert "toggleSettingsModule" in script_js
    # Ensure minimum 1 selection check is present
    assert "at least 1" in script_js or "count < 1" in script_js


def test_mobile_app_ecosystem_elements():
    mobile_dir = Path(r"C:\LastEdge\LastEdge App\mobile-app\artifacts\mobile")
    settings_ctx = (mobile_dir / "context" / "SettingsContext.tsx").read_text(encoding="utf-8")
    onboarding_modal = (mobile_dir / "components" / "EcosystemOnboardingModal.tsx").read_text(encoding="utf-8")
    tab_layout = (mobile_dir / "app" / "(tabs)" / "_layout.tsx").read_text(encoding="utf-8")
    settings_modal = (mobile_dir / "app" / "settings-modal.tsx").read_text(encoding="utf-8")

    # 1. SettingsContext persistence & types
    assert "ecosystemModules: EcosystemModules;" in settings_ctx
    assert "ecosystemSetupCompleted: boolean;" in settings_ctx
    assert "@lastedge_ecosystem_modules_v1" in settings_ctx
    assert "updateEcosystemModules" in settings_ctx

    # 2. Onboarding Modal prompt & invariant
    assert "Configuración de Servicios" in onboarding_modal
    assert "Esta app es parte del ecosistema" in onboarding_modal
    assert "¿Qué partes del ecosistema tienes activas?" in onboarding_modal
    assert "Trading Engine" in onboarding_modal
    assert "Strategy Lab" in onboarding_modal
    assert "Debes seleccionar mínimo 1 opción de las 2" in onboarding_modal

    # 3. Dynamic Tabs Layout
    assert "settings.ecosystemModules" in tab_layout
    assert "showTrading" in tab_layout
    assert "showLab" in tab_layout
    assert "href: showTrading ? undefined : null" in tab_layout
    assert "href: showLab ? undefined : null" in tab_layout

    # 4. Settings Screen Reconfiguration Section
    assert "Ecosistema LastEdge" in settings_modal
    assert "Trading Engine" in settings_modal
    assert "Strategy Lab" in settings_modal
    assert "updateEcosystemModules" in settings_modal
