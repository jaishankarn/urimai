"""Place lists for the practice portal. Taluk and ward lists are demo data, not an official directory."""
from app.contracts.facts import District

DISTRICTS = {slug: slug.replace("kanniyakumari", "Kanniyakumari").title() for slug in District.__args__
             if slug != "unknown"}
DISTRICTS.update({"nilgiris": "The Nilgiris", "tiruchirappalli": "Tiruchirappalli"})

TALUKS = {
    "madurai": ["Madurai East", "Madurai North", "Madurai South", "Madurai West", "Melur", "Peraiyur",
                "Thirumangalam", "Thiruparankundram", "Usilampatti", "Vadipatti"],
    "chennai": ["Egmore", "Guindy", "Mylapore", "Perambur", "Tondiarpet", "Velachery"],
    "coimbatore": ["Coimbatore North", "Coimbatore South", "Mettupalayam", "Pollachi", "Sulur"],
    "tiruchirappalli": ["Lalgudi", "Manapparai", "Musiri", "Srirangam", "Thiruverumbur"],
    "salem": ["Attur", "Mettur", "Omalur", "Salem"],
}


def taluks(district: str) -> list[str]:
    if district not in DISTRICTS:
        return []
    return TALUKS.get(district, [f"{DISTRICTS[district]} (demo taluk)"])


def villages(district: str, taluk: str) -> list[str]:
    if taluk not in taluks(district):
        return []
    return [f"{taluk} Ward {n}" for n in range(1, 4)]
