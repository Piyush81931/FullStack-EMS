import Employee from "../models/Employee.js";
import bcrypt from "bcrypt";
import User from "../models/User.js";

// Get employees
// GET /api/employees
export const getEmployees = async (req, res)=>{
    try {
        const { department } = req.query;
        const where = {};
        if(department) where.department = department;

        const employees = await Employee.find(where).sort({createdAt: -1}).populate("userId", "email role").lean();

        const result = employees.map((emp)=>({
            ...emp,
            id: emp._id.toString(),
            user: emp.userId ? {email: emp.userId.email, role: emp.userId.role} : null
        }))
        return res.json(result)
    } catch (error) {
        
        return res.status(500).json({error: "Failed to fetch employees"})
    }
}

// Create employee
// POST /api/employees
export const createEmployee = async (req, res)=>{
    try {
        const {firstName, lastName, email, phone, position, department, basicSalary, allowances, deductions, joinDate, password, role, bio} = req.body;

        if(!email || !password || !firstName || !lastName){
            return res.status(400).json({ error: "Missing required fields" });
        }

        const hashed = await bcrypt.hash(password, 10)
        const user = await User.create({
            email,
            password: hashed,
            role: role || "EMPLOYEE"
        })

        const employee = await Employee.create({
            userId: user._id,
            firstName,
            lastName,
            email,
            phone,
            position,
            department: department || "Engineering",
            basicSalary: Number(basicSalary) || 0,
            allowances: Number(allowances) || 0,
            deductions: Number(deductions) || 0,
            joinDate: new Date(joinDate),
            bio: bio || "",
        })
         try {
            await sendEmail({
                to: email,
                subject: "Welcome to the Team – Your Account Details",
                body: `
                    <div style="max-width: 600px; font-family: Arial, sans-serif;">
                        <h2>Welcome, ${firstName} ${lastName}! 👋</h2>
                        <p style="font-size: 16px;">Your employee account has been created. Here are your login credentials:</p>
                        <table style="font-size: 16px; width: 100%; border-collapse: collapse;">
                            <tr style="background: #f4f4f4;">
                                <td style="padding: 10px; font-weight: bold;">Email</td>
                                <td style="padding: 10px;">${email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; font-weight: bold;">Temporary Password</td>
                                <td style="padding: 10px;">${password}</td>
                            </tr>
                            <tr style="background: #f4f4f4;">
                                <td style="padding: 10px; font-weight: bold;">Position</td>
                                <td style="padding: 10px;">${position || "N/A"}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; font-weight: bold;">Department</td>
                                <td style="padding: 10px;">${department || "Engineering"}</td>
                            </tr>
                        </table>
                        <p style="font-size: 16px; color: red;">⚠️ Please log in and change your password immediately.</p>
                        <br/>
                        <p style="font-size: 16px;">Best Regards,<br/><strong>HR Team</strong></p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error("Failed to send welcome email:", emailError.message);
        }
        return res.status(201).json({success: true, employee})
    } catch (error) {
        if(error.code === 11000){
            return res.status(400).json({ error: "Email already exists" })
        }
        console.error("Create employee error:", error)
        return res.status(500).json({ error: "Failed to create employee" });
    }
}


// Update employee
// PUT /api/employees/:id
export const updateEmployee = async (req, res)=>{
    try {
        const {id} = req.params;
        const {firstName, lastName, email, phone, position, department, basicSalary, allowances, deductions, password, role, bio, employmentStatus} = req.body;

        const employee = await Employee.findById(id);
        if(!employee) return res.status(404).json({error: "Employee not found"})

       
        await Employee.findByIdAndUpdate(id, {
            firstName,
            lastName,
            email,
            phone,
            position,
            department: department || "Engineering",
            basicSalary: Number(basicSalary) || 0,
            allowances: Number(allowances) || 0,
            deductions: Number(deductions) || 0,
            employmentStatus: employmentStatus || "ACTIVE",
            bio: bio || "",
        })

         // Update user record
         const userUpdate = {email}
         if(role) userUpdate.role = role;
         if(password) userUpdate.password = await bcrypt.hash(password, 10);
         await User.findByIdAndUpdate(employee.userId, userUpdate)

        return res.json({success: true})
    } catch (error) {
        if(error.code === 11000){
            return res.status(400).json({ error: "Email already exists" })
        }
        return res.status(500).json({ error: "Failed to update employee" });
    }
}

// Delete employee
// DELETE /api/employees/:id
export const deleteEmployee = async (req, res)=>{
    try {
        const { id } = req.params;

        const employee = await Employee.findById(id)
        if(!employee) return res.status(404).json({ error: "Employee not found" });

        employee.isDeleted = true;
        employee.employmentStatus = "INACTIVE"
        await employee.save()
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: "Failed to delete employee" });
    }
}