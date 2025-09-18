from flask import Flask, render_template, request, jsonify, make_response
import mgrs
import re
import logging
from datetime import datetime
import json

app = Flask(__name__)
m = mgrs.MGRS()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Enhanced MGRS validation
def validate_mgrs_format(mgrs_code):
    """Validate MGRS coordinate format"""
    if not mgrs_code:
        return False, "MGRS code is required"
    
    # Remove spaces and convert to uppercase
    clean_mgrs = re.sub(r'\s+', '', mgrs_code.upper())
    
    # MGRS pattern: 1-2 digits + 1 letter + 2 letters + 2-10 digits (even number)
    pattern = r'^\d{1,2}[C-X][A-Z]{2}\d{2,10}$'
    
    if not re.match(pattern, clean_mgrs):
        return False, "Invalid MGRS format. Expected format: 23KKP4014597230"
    
    # Extract coordinate part (after grid zone designator and 100km square)
    # Grid zone: 1-2 digits + 1 letter, 100km square: 2 letters
    # Find where the numeric coordinates start
    coord_start = 0
    for i, char in enumerate(clean_mgrs):
        if i >= 3 and char.isdigit():  # After at least 3 chars, find first digit
            coord_start = i
            break
    
    coord_part = clean_mgrs[coord_start:]
    
    # Check if coordinate length is even (pairs of digits for easting/northing)
    if len(coord_part) % 2 != 0:
        return False, "MGRS coordinates must have even number of digits"
    
    # Validate coordinate length (must be 2, 4, 6, 8, or 10 digits)
    valid_lengths = [2, 4, 6, 8, 10]
    if len(coord_part) not in valid_lengths:
        return False, f"MGRS coordinates must have 2, 4, 6, 8, or 10 digits. Found {len(coord_part)} digits"
    
    return True, clean_mgrs

@app.route("/")
def index():
    return render_template("index.html")

@app.post("/convert")
def convert_mgrs():
    """Convert MGRS coordinates to WGS84 lat/lon with enhanced validation"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        points = data.get("points", [])
        
        if not points:
            return jsonify({"error": "No points provided"}), 400
        
        out = []
        for i, p in enumerate(points):
            code = (p.get("mgrs") or "").strip()
            name = p.get("name") or f"Ponto {i+1}"
            color = p.get("color") or "#3388ff"
            category = p.get("category") or "Ponto"

            if not code:
                out.append({
                    "name": name,
                    "mgrs": code,
                    "error": "MGRS code is required",
                    "color": color,
                    "category": category
                })
                continue
            
            # Validate MGRS format
            is_valid, result = validate_mgrs_format(code)
            if not is_valid:
                out.append({
                    "name": name,
                    "mgrs": code,
                    "error": result,
                    "color": color,
                    "category": category
                })
                continue
            
            clean_mgrs = result
            
            try:
                lat, lon = m.toLatLon(clean_mgrs)
                
                # Validate coordinates are reasonable
                if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
                    raise ValueError("Coordinates out of valid range")
                
                out.append({
                    "name": name,
                    "mgrs": clean_mgrs,
                    "lat": round(float(lat), 8),
                    "lon": round(float(lon), 8),
                    "color": color,
                    "category": category
                })
                
                logger.info(f"Successfully converted {clean_mgrs} to {lat}, {lon}")
                
            except Exception as e:
                error_msg = f"Falha ao converter MGRS: {str(e)}"
                logger.error(f"Conversion error for {clean_mgrs}: {e}")
                out.append({
                    "name": name,
                    "mgrs": clean_mgrs,
                    "error": error_msg,
                    "color": color,
                    "category": category
                })
        
        return jsonify({"points": out})
        
    except Exception as e:
        logger.error(f"Unexpected error in convert_mgrs: {e}")
        return jsonify({"error": "Internal server error"}), 500

@app.post("/export_kml")
def export_kml():
    """Export points to KML format with enhanced styling and optional route"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        points = data.get("points", [])
        connect = bool(data.get("connectRoute", False))
        
        if not points:
            return jsonify({"error": "No points to export"}), 400

        # Generate timestamp for filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Icon mapping for KML compatible icons
        kml_icon_map = {
            'circle': 'http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png',
            'target': 'http://maps.google.com/mapfiles/kml/shapes/target.png',
            'base': 'http://maps.google.com/mapfiles/kml/shapes/camping.png',
            'enemy': 'http://maps.google.com/mapfiles/kml/shapes/caution.png',
            'observation': 'http://maps.google.com/mapfiles/kml/shapes/ranger_station.png',
            'extraction': 'http://maps.google.com/mapfiles/kml/shapes/helicopter.png',
            'medical': 'http://maps.google.com/mapfiles/kml/shapes/hospitals.png',
            'supply': 'http://maps.google.com/mapfiles/kml/shapes/convenience.png',
            'checkpoint': 'http://maps.google.com/mapfiles/kml/shapes/roadblock.png',
            'sniper': 'http://maps.google.com/mapfiles/kml/shapes/target.png'
        }
        
        kml = []
        kml.append('<?xml version="1.0" encoding="UTF-8"?>')
        kml.append('<kml xmlns="http://www.opengis.net/kml/2.2">')
        kml.append(f'<Document><name>Marcadores MGRS - {timestamp}</name>')
        kml.append('<description>Exportado do Task Force MGRS Mapper v2.0</description>')
        
        # Create styles for each icon type used
        used_icons = set()
        for p in points:
            icon_type = p.get('iconType', 'circle')
            used_icons.add(icon_type)
        
        for icon_type in used_icons:
            icon_url = kml_icon_map.get(icon_type, kml_icon_map['circle'])
            kml.append(f'<Style id="style_{icon_type}">')
            kml.append(f'<IconStyle><scale>1.3</scale><Icon><href>{icon_url}</href></Icon></IconStyle>')
            kml.append('<LabelStyle><scale>1.2</scale></LabelStyle>')
            kml.append('</Style>')
        
        kml.append('<Style id="routeStyle">')
        kml.append('<LineStyle><color>ff0000ff</color><width>4</width></LineStyle>')
        kml.append('</Style>')

        # Create folder for points
        kml.append('<Folder><name>Pontos</name>')
        
        valid_points = []
        for i, p in enumerate(points):
            name = (p.get("name") or f"Ponto {i+1}").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            mgrs_code = (p.get("mgrs") or "").replace("&", "&amp;")
            category = (p.get("category") or "Ponto").replace("&", "&amp;")
            icon_type = p.get("iconType", "circle")
            color = p.get("color", "#3388ff")
            lat = p.get("lat")
            lon = p.get("lon")
            
            if lat is None or lon is None:
                continue
                
            valid_points.append(p)
            
            # Get icon name for display
            icon_names = {
                'circle': 'Padrão',
                'target': 'Alvo',
                'base': 'Base',
                'enemy': 'Inimigo',
                'observation': 'Observação',
                'extraction': 'Extração',
                'medical': 'Médico',
                'supply': 'Suprimentos',
                'checkpoint': 'Checkpoint',
                'sniper': 'Sniper'
            }
            icon_name = icon_names.get(icon_type, 'Padrão')
            
            # Enhanced description with more details
            description = f"""<![CDATA[
                <b>MGRS:</b> {mgrs_code}<br>
                <b>Categoria:</b> {category}<br>
                <b>Tipo de Ícone:</b> {icon_name}<br>
                <b>Cor:</b> {color}<br>
                <b>Coordenadas:</b> {lat:.6f}, {lon:.6f}<br>
                <b>Exportado em:</b> {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}<br>
                <b>Fonte:</b> Task Force MGRS Mapper v2.0
            ]]>"""
            
            kml.append(
                f'<Placemark><name>{name}</name>'
                f'<description>{description}</description>'
                f'<styleUrl>#style_{icon_type}</styleUrl>'
                f'<Point><coordinates>{lon},{lat},0</coordinates></Point>'
                f'</Placemark>'
            )
        
        kml.append('</Folder>')

        # Optional route
        if connect and len(valid_points) >= 2:
            kml.append('<Folder><name>Rota</name>')
            coords = " ".join([f"{p['lon']},{p['lat']},0" for p in valid_points])
            
            route_description = f"""<![CDATA[
                <b>Rota conectando {len(valid_points)} pontos</b><br>
                <b>Distância aproximada:</b> Calculada pelo Google Earth<br>
                <b>Criado em:</b> {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
            ]]"""
            
            kml.append(
                f'<Placemark><name>Rota Tática</name>'
                f'<description>{route_description}</description>'
                f'<styleUrl>#routeStyle</styleUrl>'
                f'<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode>'
                f'<coordinates>{coords}</coordinates></LineString></Placemark>'
            )
            kml.append('</Folder>')

        kml.append("</Document></kml>")
        kml_str = "\n".join(kml)

        resp = make_response(kml_str)
        resp.headers["Content-Type"] = "application/vnd.google-earth.kml+xml"
        resp.headers["Content-Disposition"] = f"attachment; filename=marcadores_mgrs_{timestamp}.kml"
        
        logger.info(f"Exported {len(valid_points)} points to KML with route={connect}")
        return resp
        
    except Exception as e:
        logger.error(f"Error exporting KML: {e}")
        return jsonify({"error": "Failed to export KML"}), 500

# Add health check endpoint
@app.route("/health")
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    })

# Add API info endpoint
@app.route("/api/info")
def api_info():
    """API information endpoint"""
    return jsonify({
        "name": "Task Force MGRS Mapper API",
        "version": "2.0.0",
        "description": "Professional MGRS coordinate conversion and mapping tool",
        "endpoints": {
            "/": "Main application",
            "/convert": "Convert MGRS to WGS84 coordinates",
            "/export_kml": "Export points to KML format",
            "/health": "Health check",
            "/api/info": "API information"
        },
        "mgrs_format": "Example: 23KKP4014597230",
        "supported_exports": ["KML", "GeoJSON", "CSV"]
    })

if __name__ == "__main__":
    logger.info("Starting Task Force MGRS Mapper v2.0.0")
    logger.info("Enhanced features: validation, theming, session management, import/export")
    app.run(host="0.0.0.0", port=8000, debug=True)
