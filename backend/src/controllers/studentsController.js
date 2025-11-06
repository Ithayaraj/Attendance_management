import { Student } from '../models/Student.js';

export const getStudents = async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 50, regPrefix = '', department = '' } = req.query;

    const query = {};
    const conditions = [];

    // Filter by registration prefix if provided
    if (regPrefix) {
      // Escape special regex characters and make it case-insensitive
      const escapedPrefix = regPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({
        registrationNo: { $regex: `^${escapedPrefix}`, $options: 'i' }
      });
    }

    // Filter by department if provided (case-insensitive, with flexible matching)
    // Handle both old format ("Technological Studies") and new format ("Department of...")
    if (department) {
      const escapedDept = department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Create department mapping for backward compatibility
      // Maps new department names to old/alternative formats
      const deptMapping = {
        'Department of Information and Communication Technology': ['Department of Information and Communication Technology', 'Technological Studies', 'ICT', 'Information and Communication Technology'],
        'Department of Bio-science': ['Department of Bio-science', 'Applied Science', 'Bio-science', 'Bio Science'],
        'Department of Physical Science': ['Department of Physical Science', 'Applied Science', 'Physical Science'],
        'Department of Business Economics': ['Department of Business Economics', 'Business Studies', 'Business Economics'],
        'Department of Human Resource Management': ['Department of Human Resource Management', 'Business Studies', 'Human Resource Management', 'HRM'],
        'Department of Marketing Management': ['Department of Marketing Management', 'Business Studies', 'Marketing Management'],
        'Department of Management and Entrepreneurship': ['Department of Management and Entrepreneurship', 'Business Studies', 'Management and Entrepreneurship'],
        'Department of Project Management': ['Department of Project Management', 'Business Studies', 'Project Management'],
        'Department of Finance and Accountancy': ['Department of Finance and Accountancy', 'Business Studies', 'Finance and Accountancy'],
        'Department of Banking and Insurance': ['Department of Banking and Insurance', 'Business Studies', 'Banking and Insurance']
      };
      
      // Get alternative department names
      const altDepts = deptMapping[department] || [department];
      
      // If registration prefix is provided, be more lenient with department matching
      // Otherwise, use exact match
      if (regPrefix && altDepts.length > 1) {
        // Use OR to match any of the alternative department names
        conditions.push({
          $or: altDepts.map(dept => ({
            department: { $regex: `^${dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
          }))
        });
      } else {
        // Exact match
        conditions.push({ 
          department: { $regex: `^${escapedDept}$`, $options: 'i' }
        });
      }
    }

    // Add search term if provided (applies to name, email, registrationNo)
    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { registrationNo: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Combine all conditions with $and if multiple, otherwise use single condition
    if (conditions.length > 1) {
      query.$and = conditions;
    } else if (conditions.length === 1) {
      Object.assign(query, conditions[0]);
    }

    // Debug logging
    console.log('Student query:', JSON.stringify(query, null, 2));
    console.log('Query params:', { regPrefix, department, search, page, limit });

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    console.log(`Found ${total} students matching query`);

    res.json({
      success: true,
      data: {
        students,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in getStudents:', error);
    next(error);
  }
};

export const getStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    next(error);
  }
};

export const createStudent = async (req, res, next) => {
  try {
    const student = await Student.create(req.body);

    res.status(201).json({
      success: true,
      data: student
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
