import os
import json
import re
import requests

# Define paths
WORKSPACE_DIR = r"c:\Users\obaiz\OneDrive\Desktop\AI-IDS-main\AI-IDS-main"
EXPORT_DIR = os.path.join(WORKSPACE_DIR, "stitch-sentinel-export")
CODE_DIR = os.path.join(EXPORT_DIR, "code")
SCREENSHOTS_DIR = os.path.join(EXPORT_DIR, "screenshots")
DESKTOP_DIR = os.path.join(SCREENSHOTS_DIR, "desktop")
TABLET_DIR = os.path.join(SCREENSHOTS_DIR, "tablet")
MOBILE_DIR = os.path.join(SCREENSHOTS_DIR, "mobile")
ASSETS_DIR = os.path.join(EXPORT_DIR, "assets")
LOGO_DIR = os.path.join(ASSETS_DIR, "logo")
ICONS_DIR = os.path.join(ASSETS_DIR, "icons")
IMAGES_DIR = os.path.join(ASSETS_DIR, "images")
ANALYSIS_DIR = os.path.join(EXPORT_DIR, "analysis")

# Create directories if they don't exist
for d in [CODE_DIR, DESKTOP_DIR, TABLET_DIR, MOBILE_DIR, LOGO_DIR, ICONS_DIR, IMAGES_DIR, ANALYSIS_DIR]:
    os.makedirs(d, exist_ok=True)

# Path to the JSON results from StitchMCP
STEPS_DIR = r"C:\Users\obaiz\.gemini\antigravity-ide\brain\c87a8054-23be-4280-ad78-46e01d4f6d7b\.system_generated\steps"
SCREENS_JSON_PATH = os.path.join(STEPS_DIR, "29", "output.txt")
PROJECT_JSON_PATH = os.path.join(STEPS_DIR, "23", "output.txt")

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')

def download_file(url, dest_path):
    if not url:
        return False
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        with open(dest_path, 'wb') as f:
            f.write(r.content)
        print(f"Downloaded: {os.path.basename(dest_path)}")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def main():
    print("Starting Stitch assets extraction...")

    # Load Project metadata
    if os.path.exists(PROJECT_JSON_PATH):
        with open(PROJECT_JSON_PATH, 'r', encoding='utf-8') as f:
            proj_data = json.load(f)
        
        # Save design system spec if present
        design_md = proj_data.get("designMd", "")
        if design_md:
            spec_path = os.path.join(ANALYSIS_DIR, "DESIGN_SYSTEM_SPEC.md")
            with open(spec_path, 'w', encoding='utf-8') as f_out:
                f_out.write(design_md)
            print(f"Saved: DESIGN_SYSTEM_SPEC.md")

        # Save design tokens json for reference
        tokens_path = os.path.join(ANALYSIS_DIR, "STITCH_TOKENS.json")
        with open(tokens_path, 'w', encoding='utf-8') as f_out:
            json.dump(proj_data.get("designTheme", {}), f_out, indent=2)
        print(f"Saved: STITCH_TOKENS.json")
    else:
        print(f"Project metadata not found at {PROJECT_JSON_PATH}")

    # Load Screens metadata
    if os.path.exists(SCREENS_JSON_PATH):
        with open(SCREENS_JSON_PATH, 'r', encoding='utf-8') as f:
            screens_data = json.load(f)
        
        screens = screens_data.get("screens", [])
        print(f"Found {len(screens)} screens in Stitch project metadata.")

        for i, s in enumerate(screens, 1):
            title = s.get("title", f"screen_{i}")
            device_type = s.get("deviceType", "DESKTOP")
            slug = slugify(title)
            screen_id = s.get("name", "").split('/')[-1]
            
            print(f"\nProcessing screen {i}/{len(screens)}: {title} ({device_type})")

            # 1. Download HTML code
            html_code_info = s.get("htmlCode", {})
            html_url = html_code_info.get("downloadUrl")
            mime_type = html_code_info.get("mimeType", "text/html")
            
            if html_url:
                if "svg" in mime_type:
                    dest_path = os.path.join(ICONS_DIR, f"{slug}.svg")
                else:
                    dest_path = os.path.join(CODE_DIR, f"{slug}.html")
                download_file(html_url, dest_path)

            # 2. Download Screenshot
            screenshot_info = s.get("screenshot", {})
            screenshot_url = screenshot_info.get("downloadUrl")
            
            if screenshot_url:
                # Direct screenshot mapping to folder
                if device_type == "MOBILE" or "flow" in slug or "prototype" in slug:
                    dest_dir = MOBILE_DIR
                elif device_type == "TABLET":
                    dest_dir = TABLET_DIR
                else:
                    dest_dir = DESKTOP_DIR
                
                screenshot_dest = os.path.join(dest_dir, f"{slug}.png")
                download_file(screenshot_url, screenshot_dest)

                # If it's a logo screen, save additionally to logo directory
                if "logo" in slug or screen_id == "c83cc80ee83b4a5bbb47ce7e33ea7fdc":
                    logo_dest = os.path.join(LOGO_DIR, "logo.png")
                    download_file(screenshot_url, logo_dest)
                    print(f"Logo saved to {logo_dest}")
                
                # If it's compact icon, save as icon.png too
                if "compact_icon" in slug or screen_id == "60360b7f55314c258a5198bcb8b4cb03":
                    icon_dest = os.path.join(LOGO_DIR, "icon.png")
                    download_file(screenshot_url, icon_dest)
                    print(f"Icon saved to {icon_dest}")

    else:
        print(f"Screens metadata not found at {SCREENS_JSON_PATH}")

    print("\nStitch assets extraction completed!")

if __name__ == "__main__":
    main()
