"""Run against a built localhost server and isolated ezdb_test databases.
Requires Python Playwright; isolated fixture credentials come from environment variables.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("EZDB_URL", "http://127.0.0.1:8080")
SHOTS = Path(os.environ["TMPDIR"]) / "ezdb-shots"
SHOTS.mkdir(exist_ok=True)
results = []

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for engine in ("postgres", "mongo"):
        for width in (1280, 390):
            ctx = browser.new_context(viewport={"width": width, "height": 844}, is_mobile=width == 390, has_touch=width == 390)
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            requests = []
            page.on("request", lambda request: requests.append(request.url))
            page.goto(BASE)
            expect(page.get_by_role("button", name="Connect", exact=True)).to_be_visible()
            expect(page.get_by_role("contentinfo")).to_contain_text("v1.0.1")
            source_link = page.get_by_role("contentinfo").get_by_role("link", name="GitHub", exact=True)
            expect(source_link).to_be_visible()
            expect(source_link).to_have_attribute("href", "https://github.com/c4lyp5o/ezdb")
            expect(source_link).to_have_attribute("rel", "noopener noreferrer")
            assert not any("/api/tables" in url for url in requests)
            assert ctx.request.get(BASE + "/api/tables").status == 401
            page.screenshot(path=str(SHOTS / f"login-{width}.png"))
            # Submit the real form using isolated test database credentials.
            opts = {"engine": engine, "host": "127.0.0.1", "port": 55432 if engine == "postgres" else 57017, "database": "ezdb_test", "user": "postgres" if engine == "postgres" else "ezdb", "password": os.environ["PG_PASSWORD" if engine == "postgres" else "MONGO_PASSWORD"]}
            page.locator("form select").select_option(engine)
            for label, value in (("Host", opts["host"]), ("Port", str(opts["port"])), ("Database", opts["database"]), ("User", opts["user"]), ("Password", opts["password"])):
                page.get_by_label(label, exact=True).fill(value)
            with page.expect_response(lambda r: r.url.endswith("/api/connect") and r.request.method == "POST") as login:
                page.get_by_role("button", name="Connect", exact=True).click()
            assert login.value.status == 201
            expect(page.get_by_role("button", name="Disconnect", exact=True)).to_be_visible()
            source_link = page.get_by_role("contentinfo").get_by_role("link", name="GitHub", exact=True)
            expect(source_link).to_be_visible()
            expect(source_link).to_have_attribute("href", "https://github.com/c4lyp5o/ezdb")
            expect(source_link).to_have_attribute("rel", "noopener noreferrer")
            table = "ezdb_items" if engine == "postgres" else "ezdb_docs"
            endpoint = BASE + "/api/tables/" + table
            seeds = []
            try:
                for index in range(12):
                    seed: dict = {"name": f"ui-seed-{width}-{index}"}
                    if engine == "postgres":
                        seed["id"] = 1000 + index
                    response = ctx.request.post(endpoint + "/rows", data=seed)
                    assert response.status == 201
                    seeds.append({"id": seed["id"]} if engine == "postgres" else {"_id": response.json()["insertedId"]})
                page.reload()
                expect(page.get_by_role("button", name=table, exact=True)).to_be_visible()
                page.get_by_role("button", name=table, exact=True).click()
                expect(page.locator("tbody tr")).not_to_have_count(0)
                page.locator("main select").select_option("10")
                expect(page.locator("tbody tr")).to_have_count(10)
                page.get_by_role("button", name="Next", exact=True).click()
                expect(page.get_by_text("Page 2 / 2", exact=True)).to_be_visible()
                page.get_by_role("button", name="Prev", exact=True).click()
                expect(page.get_by_text("Page 1 / 2", exact=True)).to_be_visible()
                page.get_by_role("button", name="Add", exact=True).click()
                new: dict = {"name": "ui-created"}
                if engine == "postgres":
                    new["id"] = 900
                page.locator("#record-json").fill(json.dumps(new))
                page.get_by_role("button", name="Save", exact=True).click()
                expect(page.locator("#record-json")).to_have_count(0)
                page.locator("main select").select_option("100")
                row = page.locator("tbody tr").filter(has_text="ui-created")
                expect(row).to_have_count(1)
                row.get_by_role("button", name="Edit", exact=True).click()
                page.locator("#record-json").fill("{")
                page.get_by_role("button", name="Save", exact=True).click()
                expect(page.get_by_role("alert")).to_be_visible()
                page.locator("#record-json").fill('{"name":"ui-edited"}')
                page.get_by_role("button", name="Save", exact=True).click()
                row = page.locator("tbody tr").filter(has_text="ui-edited")
                expect(row).to_have_count(1)
                row.get_by_role("button", name="Delete", exact=True).click()
                expect(page.get_by_role("dialog")).to_be_visible()
                expect(page.get_by_role("button", name="Cancel", exact=True)).to_be_focused()
                page.keyboard.press("Shift+Tab")
                expect(page.get_by_role("dialog").get_by_role("button", name="Delete", exact=True)).to_be_focused()
                page.keyboard.press("Escape")
                expect(page.get_by_role("dialog")).to_have_count(0)
                expect(row.get_by_role("button", name="Delete", exact=True)).to_be_focused()
                expect(row).to_have_count(1)
                row.get_by_role("button", name="Delete", exact=True).click()
                page.get_by_role("dialog").get_by_role("button", name="Delete", exact=True).click()
                expect(page.locator("tbody tr").filter(has_text="ui-edited")).to_have_count(0)
                actual = ctx.request.get(endpoint + "?size=100").json()
                assert not any(r.get("name") in ("ui-created", "ui-edited") for r in actual["rows"])
                assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
                page.screenshot(path=str(SHOTS / f"{engine}-{width}.png"), full_page=True)
                page.reload()
                expect(page.get_by_role("button", name="Disconnect", exact=True)).to_be_visible()
                page.get_by_role("button", name="Disconnect", exact=True).click()
                expect(page.get_by_role("button", name="Connect", exact=True)).to_be_visible()
                assert ctx.request.get(BASE + "/api/tables").status == 401
                assert not errors, errors
                results.append({"engine": engine, "width": width, "crud": "pass", "pagination": "pass", "reload": "pass", "overflow": False, "pageErrors": errors})
            finally:
                # Reconnect only to clean the exact seeded keys; never touch other databases.
                ctx.request.post(BASE + "/api/connect", data=opts)
                import base64
                for key in seeds:
                    encoded = base64.urlsafe_b64encode(json.dumps(key).encode()).decode().rstrip("=")
                    assert ctx.request.delete(endpoint + "/rows/" + encoded).status == 200
                ctx.request.post(BASE + "/api/disconnect")
                ctx.close()
    browser.close()
print(json.dumps({"checks": results, "screenshots": str(SHOTS)}, indent=2))
