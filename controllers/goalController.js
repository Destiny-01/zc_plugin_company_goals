/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
/* eslint-disable camelcase */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-shadow */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
const { v4: uuidv4 } = require('uuid');
const { find, findAll, findById, insertOne, insertMany, deleteOne, updateOne, deleteMany } = require('../db/databaseHelper');
const { goalSchema, likeGoalSchema, getGoalLikesSchema } = require('../schemas');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');


exports.getAllGoals = catchAsync(async (req, res, next) => {
  const { org_id: orgId } = req.query;

  if (!orgId) {
    return res.status(400).send({error: 'org_id is required'})
  }
  // Search for all Goals
  const goals = await findAll('goals', orgId);

  if (goals.data.status === 200) {
    res.status(200).json({ status: 200, message: 'success', data: goals.data.data })
  }
});




exports.createGoal = async ( req, res, next) => {

    const roomId = uuidv4();
    const { org_id: orgId } = req.query;
  const { goal_name: title, category } = req.body;
  
    const goal = req.body;
    let goals;

    const data = {
      room_id: roomId,
      organization_id: orgId,
      ...goal,
    };

    if (!orgId) {
      res.status(400).send({ error: 'Organization_id is required' });
    }

  try {
     
   await goalSchema.validateAsync(req.body);

    } catch (err) {
      if (err) return res.status(400).json(err.details);
    }

    try {
      goals = await find('goals', { goal_name: title }, orgId);
      
      const { data: foundGoal } = goals.data;


      if (foundGoal[0].goal_name === title && foundGoal[0].category === category) {
        return res
          .status(400)
          .send({
            error: `Goal with the title: '${title}' and  category: '${category}' already exists on your organization`,
          });
      }
    } catch (error) {
      goals = await insertOne('goals', data, orgId);
    }

    res.status(200).json({ message: 'success', ...goals.data, data });
  
};

exports.getSingleGoal = catchAsync(async (req, res, next) => {
  // NOTICE: YOU ARE GETTING THE GOAL BY ITS UUID STRING
  let users;
  const { room_id: id, org_id: org } = req.query;

 if (!id || !org) {
   return res.status(400).send({ error: `Parameters missing room id or organization id` });
 }

  const goal = await find('goals', { room_id: id }, org);


  if (goal.data.data === null){
  return res.status(400).send({error: `The goal with the room id of ${id} does not exist`})
  }

  try {
    
  const findUsers = await find('roomusers', { room_id: id }, org);

    const { data: getUsers } = findUsers.data;
    
    const mapResults = getUsers.map((user) => {
      const result = user.user_id;
      return result
    })
    
    const data = {
      goal: goal.data.data,
      assigned_users: mapResults
    }
  
    res.status(200).json({ status: 200, message: 'success', data });
  } catch (err) {

    users = 'No user has been assigned to this goal';
    const data = {
      goal: goal.data.data,
      users,
    };

    res.status(200).json({ status: 200, message: 'success', data});
}
  next(new AppError({ message: 'invalid request' }, {statusCode: 400}));
});



exports.updateSingleGoalById = catchAsync(async (req, res, next) => {
  // First, Get the goalId from req.params
  const goalId = req.params.id;
  const { org_id: orgId } = req.query;
  
  // Then, send update to zuri core
  const updatedGoal = await updateOne(collectionName='goals', organization_id=orgId, data=req.body, filter={}, id=goalId)


  // send the updated goal to client.
  return res.status(200).json(updatedGoal.data);
});

exports.getArchivedGoals = catchAsync(async (req, res, next) => {

  // Gets archived goals
  const goals = await find('goals', {achieved: false});

  // Condition if there are no archived goals
  if (goals.data.data.length < 1) {
    goals.data.data = 'No archived goals yet.'
  }

  // Return Response
  res.status(200).json({ status: 200, message: 'success', data: goals.data.data });
});

exports.deleteGoalById = catchAsync(async (req, res, next) => {
  // First, Get the goalId & orgid from req.params
  const { goal_id: id, org_id: org } = req.query;
 
  // The organization id is required.
  if (!org) {
    res.status(400).send({ error: 'Organization_id is required' });
  }

  // find the goal first to ensure the goal was created by the organization
  const goal = await find('goals', { _id: id }, org);

  if (!goal.data.data) {
    res.status(404).send({ error: 'There is no goal of this id attached to this organization id that was found.' });
  }
  

     const { room_id: roomId } = goal.data.data;
   
// delete assigned records
    await deleteMany('roomusers', { room_id: roomId }, org);

  // Then, delete the goal.
  const response = await deleteOne(collectionName = 'goals', data = org, _id = id);
  

  res.status(200).json({status: 200, message: 'Goal deleted successfully.', response: response.data.data});

});



exports.assignGoal = catchAsync(async (req, res, next) => {
 
     const { room_id, user_id, org_id: org } = req.query;

     // check that the room_id is valid
     const room = await find('goals', { room_id }, org);

     if (room.data.data.length <= 0) {
       return next(new AppError('Room not found', 404));
     }
     // check that user isnt already in the room
    
  try {
    const roomuser = await find('roomusers', { room_id, user_id }, org);

    if (roomuser !== null && roomuser.data.data.length > 0) {
      return res.status(400).send({ message: 'User alreaady assigned to goal' });
    }
  } catch (error) {
  

    if (error) {
      const getAllRooms = await findAll('goals', org);
      const { data: allRooms } = getAllRooms.data;

      const getRoom = allRooms.filter((el) => el.room_id === room_id);
     
      const data = {
        goal_id: getRoom[0]._id,
        room_id: getRoom[0].room_id,
        title: getRoom[0].goal_name,
        access: getRoom[0].access,
        user_id,
      };
    
      const roomuser = await insertOne('roomusers', data, org);
   
      res.status(201).json({
             status: 'success',
             data: roomuser.data,
      });
    }
  }
    
 
});



exports.removeAssigned = catchAsync(async (req, res, next) => {

    const { room_id, user_id, org_id: org } = req.query;

    // check that the room_id is valid
    const room = await find('goals', { room_id }, org);

    if (room.data.data === null) {
      return res.status(404).send({error: `This room does not exist on the goals collection`});
    }

 
  const roomuser = await find('roomusers', { room_id, user_id }, org);

  const { _id: assignedObjectId } = roomuser.data.data[0];

    if (roomuser.data.data === null) {
    return res.status(404).send({ message: 'There are no users assigned to this goal' });
  }

   
  const deleteRoomUser = await deleteOne(data = 'roomusers', data = org, _id=assignedObjectId);
  
 res.status(201).json({
   status: 'success',
   data: deleteRoomUser.data,
 });
   
 
});



exports.likeGoal = catchAsync(async (req, res, next) => {
  const { goal_id: goalId, user_id: userId, org_id: orgId } = req.query;

  // Validate the body
  await likeGoalSchema.validateAsync({ goalId, userId, orgId });

  // check that the goal_id is valid
  const goal = await find('goals', { _id: goalId }, orgId);

  if (!goal.data.data) {
    return next(new AppError('There is no goal of this id attached to this organization id that was found.', 404));
  }

  // check if user already liked goal
  const like = await find('goallikes', { goal_id: goalId, user_id: userId }, orgId);

  // add like if it doesnt exist
  if (!like.data.data) {
    addedLike = await insertOne('goallikes', { goal_id: goalId, user_id: userId }, orgId);

    return res.status(201).json({
      status: 'success',
      message: 'Goal like added',
      data: {},
    });
  }

  removeLike = await deleteOne('goallikes', orgId, like.data.data[0]._id);
  // delete like from db
  res.status(201).json({
    status: 'success',
    message: 'Goal like removed',
    data: {},
  });
});

exports.getGoalLikes = catchAsync(async (req, res, next) => {
  const { goal_id: goalId, org_id: orgId } = req.query;

  // Validate the body
  await getGoalLikesSchema.validateAsync({ goalId, orgId });

  // check that the goal_id is valid
  const goal = await find('goals', { _id: goalId }, orgId);

  if (!goal.data.data) {
    return next(new AppError('There is no goal of this id attached to this organization id that was found.', 404));
  }

  // check if user already liked goal
  const like = await find('goallikes', { goal_id: goalId }, orgId);
  if (!like.data.data) {
    return res.status(200).json({
      status: 'success',
      data: { count: 0, likes: [] },
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      count: like.data.data.length,
      likes: like.data.data,
    },
  });
});

exports.checkUserLike = catchAsync(async (req, res, next) => {
  const { goal_id: goalId, user_id: userId, org_id: orgId } = req.query;

  // Validate the body
  await likeGoalSchema.validateAsync({ goalId, userId, orgId });

  // check that the goal_id is valid
  const goal = await find('goals', { _id: goalId }, orgId);

  if (!goal.data.data) {
    return next(new AppError('There is no goal of this id attached to this organization id that was found.', 404));
  }

  // check if user already liked goal
  const like = await find('goallikes', { goal_id: goalId, user_id: userId }, orgId);
  if (!like.data.data) {
    return res.status(200).json({
      status: 'success',
      data: false,
    });
  }
  res.status(200).json({
    status: 'success',
    data: true,
  });
});