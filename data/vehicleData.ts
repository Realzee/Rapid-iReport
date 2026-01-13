
export const vehicleMakes: string[] = [
    "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia", "Land Rover", "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "Nissan", "Ram", "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo"
];

export const vehicleModelsByMake: Record<string, string[]> = {
    toyota: ["4Runner", "Camry", "Corolla", "Highlander", "Prius", "RAV4", "Sienna", "Tacoma", "Tundra"],
    ford: ["Bronco", "Edge", "Escape", "Explorer", "F-150", "Focus", "Fusion", "Mustang", "Ranger"],
    honda: ["Accord", "Civic", "CR-V", "HR-V", "Odyssey", "Pilot", "Ridgeline"],
    chevrolet: ["Blazer", "Camaro", "Corvette", "Equinox", "Malibu", "Silverado", "Suburban", "Tahoe", "Traverse"],
    nissan: ["Altima", "Armada", "Frontier", "Maxima", "Murano", "Pathfinder", "Rogue", "Sentra", "Titan", "Versa"],
    jeep: ["Cherokee", "Compass", "Gladiator", "Grand Cherokee", "Wrangler"],
    hyundai: ["Elantra", "Kona", "Palisade", "Santa Fe", "Sonata", "Tucson"],
    kia: ["Forte", "K5", "Seltos", "Sorento", "Soul", "Sportage", "Telluride"],
    subaru: ["Ascent", "Crosstrek", "Forester", "Impreza", "Legacy", "Outback"],
    bmw: ["3 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X7"],
    "mercedes-benz": ["C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE", "GLS"],
    volkswagen: ["Atlas", "Golf", "Jetta", "Passat", "Taos", "Tiguan"],
    audi: ["A3", "A4", "A6", "Q3", "Q5", "Q7", "Q8"],
    lexus: ["ES", "GX", "IS", "LS", "NX", "RX"],
    tesla: ["Model 3", "Model S", "Model X", "Model Y"],
};

export const vehicleColors: string[] = [
    "Black", "White", "Silver", "Gray", "Red", "Blue", "Brown", "Green", "Beige", "Gold", "Orange", "Yellow", "Purple", "Charcoal"
];
