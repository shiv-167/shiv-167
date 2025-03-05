class Rebar {
    constructor(dia) {
        this.dia = dia;
        this.Area = Math.PI * Math.pow(dia / 2, 2); // Assuming circular cross-section
    }
}

class LongitudinalRebar extends Rebar {
    constructor(dia, X, Y, Dx, Dy, xu, fck, fy) {
        super(dia);
        
        this.X = X;
        this.Y = Y;
        this.leverArmX = this.X - Dx / 2;
        this.leverArmY = this.Y - Dy / 2;
        
        this.strainX = this.calculateStrain(xu, Dx, this.leverArmX);
        this.strainY = this.calculateStrain(xu, Dy, this.leverArmY);
        
        this.fcX = this.getFc(this.strainX, fck);
        this.fcY = this.getFc(this.strainY, fck);
        
        this.fsX = this.getFs(this.strainX, fy);
        this.fsY = this.getFs(this.strainY, fy);
        
        this.Px = this.Area * (this.fsX - this.fcX);
        this.Py = this.Area * (this.fsY - this.fcY);
        
        this.Mx = this.Px * this.leverArmX;
        this.My = this.Py * this.leverArmY;
    }

    calculateStrain(xu, D, leverArm) {
        let y = leverArm;
        if (xu > D) {
            return 0.002 * (1.0 + (y - D / 14.0) / (xu - 3.0 * D / 7.0));
        } else {
            return 0.0035 * ((xu - D / 2.0 + y) / xu);
        }
    }

    getFc(strain, fck) {
        if (strain <= 0) return 0;
        if (strain >= 0.002) return 0.447 * fck;
        return 447.0 * strain * (1.0 - 250.0 * strain) * fck;
    }

    getFs(strain, fy) {
        const stress = this.getSteelStress(Math.abs(strain), fy);
        return strain < 0 ? -stress : stress;
    }

    getSteelStress(strain, fy) {
        // Placeholder for actual steel stress-strain curve logic
        return Math.min(fy, 200 * strain); // Simplified linear approximation
    }
}

class ColumnProperties {
    constructor(Dx, Dy, nrX, nrY, clearCover, DiaTies, DiaCorner, DiaOther, fck, fy, xu) {
        this.Dx = Dx;
        this.Dy = Dy;
        this.nrX = nrX;
        this.nrY = nrY;
        this.ClearCover = clearCover;
        this.DiaCorner = DiaCorner;
        this.DiaTies = DiaTies;
        this.DiaOther = DiaOther;
        this.fck = fck;
        this.fy = fy;
        
        this.EffectiveCover = this.calculateEffectiveCover(clearCover, DiaTies, DiaCorner);
        
        this.CornerRebars = [];
        this.RebarsAlongX = [];
        this.RebarsAlongY = [];
        
        this.initializeRebars(xu);
        this.calculateForcesAndMoments(xu);
    }

    calculateEffectiveCover(clearCover, DiaTies, DiaCorner) {
        return clearCover + DiaTies + DiaCorner / 2.0;
    }

    initializeRebars(xu) {
        this.CornerRebars.push(new LongitudinalRebar(this.DiaCorner, this.EffectiveCover, this.EffectiveCover, this.Dx, this.Dy, xu, this.fck, this.fy));
        this.CornerRebars.push(new LongitudinalRebar(this.DiaCorner, this.Dx - this.EffectiveCover, this.EffectiveCover, this.Dx, this.Dy, xu, this.fck, this.fy));
        this.CornerRebars.push(new LongitudinalRebar(this.DiaCorner, this.Dx - this.EffectiveCover, this.Dy - this.EffectiveCover, this.Dx, this.Dy, xu, this.fck, this.fy));
        this.CornerRebars.push(new LongitudinalRebar(this.DiaCorner, this.EffectiveCover, this.Dy - this.EffectiveCover, this.Dx, this.Dy, xu, this.fck, this.fy));
        
        let spacingX = (this.Dx - 2.0 * this.EffectiveCover) / (this.nrX - 1);
        let spacingY = (this.Dy - 2.0 * this.EffectiveCover) / (this.nrY - 1);
        
        for (let i = 1; i < this.nrX - 1; i++) {
            let x = this.EffectiveCover + i * spacingX;
            this.RebarsAlongX.push(new LongitudinalRebar(this.DiaOther, x, this.EffectiveCover, this.Dx, this.Dy, xu, this.fck, this.fy));
            this.RebarsAlongX.push(new LongitudinalRebar(this.DiaOther, x, this.Dy - this.EffectiveCover, this.Dx, this.Dy, xu, this.fck, this.fy));
        }

        for (let i = 1; i < this.nrY - 1; i++) {
            let y = this.EffectiveCover + i * spacingY;
            this.RebarsAlongY.push(new LongitudinalRebar(this.DiaOther, this.EffectiveCover, y, this.Dx, this.Dy, xu, this.fck, this.fy));
            this.RebarsAlongY.push(new LongitudinalRebar(this.DiaOther, this.Dx - this.EffectiveCover, y, this.Dx, this.Dy, xu, this.fck, this.fy));
        }
    }

    calculateForcesAndMoments(xu) {
        this.Csx = [...this.CornerRebars, ...this.RebarsAlongX, ...this.RebarsAlongY].reduce((sum, p) => sum + p.Px, 0);
        this.Csy = [...this.CornerRebars, ...this.RebarsAlongX, ...this.RebarsAlongY].reduce((sum, p) => sum + p.Py, 0);
        this.Msx = [...this.CornerRebars, ...this.RebarsAlongX, ...this.RebarsAlongY].reduce((sum, p) => sum + p.Mx, 0);
        this.Msy = [...this.CornerRebars, ...this.RebarsAlongX, ...this.RebarsAlongY].reduce((sum, p) => sum + p.My, 0);
        
        this.gx = this.calculateG(xu, this.Dx);
        this.gy = this.calculateG(xu, this.Dy);
        
        this.x_x = this.calculateX(xu, this.Dx, this.gx);
        this.x_y = this.calculateX(xu, this.Dy, this.gy);
        
        this.Ccx = this.calculateA(xu, this.Dx, this.gx) * this.fck * this.Dx * this.Dy;
        this.Ccy = this.calculateA(xu, this.Dy, this.gy) * this.fck * this.Dx * this.Dy;
        
        this.Mcx = this.Ccx * (0.5 * this.Dx - this.x_x);
        this.Mcy = this.Ccy * (0.5 * this.Dy - this.x_y);
        
        this.Px = this.Ccx + this.Csx;
        this.Py = this.Ccy + this.Csy;
        this.Mx = this.Mcx + this.Msx;
        this.My = this.Mcy + this.Msy;
    }

    calculateG(xu, D) {
        return 16 / Math.pow((7.0 * xu / D - 3.0), 2);
    }

    calculateX(xu, D, g) {
        return xu > D ? (0.5 - 8 * g / 49.0) * (D / (1.0 - 4.0 * g / 21.0)) : 0.416 * xu;
    }

    calculateA(xu, D, g) {
        return xu > D ? 0.447 * (1.0 - 4.0 * g / 21.0) : 0.362 * xu / D;
    }
}